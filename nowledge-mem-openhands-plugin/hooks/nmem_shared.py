#!/usr/bin/env python3
"""Shared Nowledge Mem plugin hook utilities for OpenHands & Multi-Agent Orchestrations."""

from __future__ import annotations

import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any


_DEFAULT_API_URL = "http://127.0.0.1:14242"
_BACKEND_UNREACHABLE_FLAG = False


def read_hook_input() -> dict[str, Any]:
    """Read and parse JSON from stdin."""
    try:
        content = sys.stdin.read().strip()
        return json.loads(content) if content else {}
    except Exception:
        return {}


def emit(payload: dict[str, Any]) -> None:
    """Write JSON to stdout and flush."""
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


def is_backend_unreachable() -> bool:
    global _BACKEND_UNREACHABLE_FLAG
    return _BACKEND_UNREACHABLE_FLAG


def mark_backend_unreachable() -> None:
    global _BACKEND_UNREACHABLE_FLAG
    _BACKEND_UNREACHABLE_FLAG = True


def reset_backend_unreachable() -> None:
    global _BACKEND_UNREACHABLE_FLAG
    _BACKEND_UNREACHABLE_FLAG = False


def get_local_config(cwd: str | Path | None = None) -> dict[str, Any]:
    """Read local .config.json from workspace root (preferred) or plugin root if present."""
    plugin_root = Path(__file__).resolve().parent.parent
    target_dir = Path(cwd).resolve() if cwd else Path.cwd().resolve()

    # Workspace config takes precedence over plugin-root config
    for cfg_path in (target_dir / ".config.json", plugin_root / ".config.json"):
        if cfg_path.is_file():
            try:
                data = json.loads(cfg_path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
            except Exception:
                pass
    return {}


def get_effective_config(cwd: str | Path | None = None) -> tuple[str, str | None]:
    """Resolve effective API URL and API key following the hierarchy:
    1. NMEM_API_URL / NMEM_API_KEY environment variables
    2. Local workspace .config.json at workspace root
    3. Plugin-root .config.json
    4. Global ~/.nowledge-mem/config.json (unless NMEM_IGNORE_HOST_CONFIG is set)
    5. Fallback default http://127.0.0.1:14242
    """
    env_url = os.environ.get("NMEM_API_URL", "").strip()
    env_key = os.environ.get("NMEM_API_KEY", "").strip() or None
    ignore_host = os.environ.get("NMEM_IGNORE_HOST_CONFIG", "").strip().lower() in ("1", "true", "yes")

    api_url = env_url
    api_key = env_key

    plugin_root = Path(__file__).resolve().parent.parent
    target_dir = Path(cwd).resolve() if cwd else Path.cwd().resolve()

    # Evaluate local config layers individually with strict URL/key pairing
    local_layers: list[Path] = []
    if (target_dir / ".config.json").is_file():
        local_layers.append(target_dir / ".config.json")
    if (plugin_root / ".config.json").is_file() and (plugin_root / ".config.json") not in local_layers:
        local_layers.append(plugin_root / ".config.json")

    for layer_path in local_layers:
        if api_url and api_key:
            break
        try:
            layer_data = json.loads(layer_path.read_text(encoding="utf-8"))
            if isinstance(layer_data, dict):
                l_url = str(layer_data.get("apiUrl") or layer_data.get("api_url") or "").strip().rstrip("/")
                l_key = str(layer_data.get("apiKey") or layer_data.get("api_key") or "").strip() or None
                if not api_url and l_url:
                    api_url = l_url
                    if l_key:
                        api_key = l_key
                elif api_url and not api_key and l_key:
                    if api_url == l_url:
                        api_key = l_key
        except Exception:
            pass

    # Check ~/.nowledge-mem/config.json
    if not ignore_host and (not api_url or not api_key):
        global_cfg_file = Path("~/.nowledge-mem/config.json").expanduser()
        if global_cfg_file.is_file():
            try:
                global_data = json.loads(global_cfg_file.read_text(encoding="utf-8"))
                if isinstance(global_data, dict):
                    g_url = str(global_data.get("apiUrl") or global_data.get("api_url") or "").strip().rstrip("/")
                    g_key = str(global_data.get("apiKey") or global_data.get("api_key") or "").strip() or None
                    if not api_url and g_url:
                        api_url = g_url
                        if g_key:
                            api_key = g_key
                    elif api_url and not api_key and g_key:
                        if api_url == g_url:
                            api_key = g_key
            except Exception:
                pass

    if not api_url:
        api_url = _DEFAULT_API_URL

    return api_url.rstrip("/"), api_key


def _make_auth_headers(api_key: str | None = None) -> dict[str, str]:
    headers = {"APP": "OpenHands"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        headers["X-NMEM-API-Key"] = api_key
        headers["X-MEM-API-Key"] = api_key
    return headers


def http_request(
    endpoint: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    timeout: float = 2.0,
    cwd: str | Path | None = None,
) -> dict[str, Any] | list[Any] | None:
    """Execute direct REST HTTP request to Nowledge Mem backend (<30ms)."""
    if is_backend_unreachable():
        return None

    api_url, api_key = get_effective_config(cwd)
    url = f"{api_url}{endpoint}"

    headers = {
        "User-Agent": "NowledgeMem-OpenHands/0.1.0",
        "Accept": "application/json",
        **_make_auth_headers(api_key),
    }

    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            reset_backend_unreachable()
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return {}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            # Reload config and retry once
            api_url, api_key = get_effective_config(cwd)
            headers.update(_make_auth_headers(api_key))
            req_retry = urllib.request.Request(f"{api_url}{endpoint}", data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req_retry, timeout=timeout) as retry_resp:
                    reset_backend_unreachable()
                    raw = retry_resp.read().decode("utf-8")
                    return json.loads(raw) if raw.strip() else {}
            except Exception:
                mark_backend_unreachable()
        elif e.code >= 500:
            mark_backend_unreachable()
        return None
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
        mark_backend_unreachable()
        return None
    except Exception:
        return None


def get_host_agent_fingerprint(prefix: str = "openhands") -> str:
    """Derive a stable agent-identity fingerprint from system/container sources."""
    # 1. Container check
    overlay_id = _extract_overlay_id()
    if overlay_id:
        digest = hashlib.sha256(overlay_id.encode("utf-8")).hexdigest()[:8]
        return f"{prefix}-overlay-{digest}"

    # 2. Native OS IDs
    raw_id = ""
    if sys.platform.startswith("win"):
        raw_id = _get_windows_machine_guid()
    elif sys.platform == "darwin":
        raw_id = _get_macos_hardware_uuid()
    else:
        raw_id = _get_linux_machine_id()

    # 3. MAC address fallback
    if not raw_id:
        try:
            node = uuid.getnode()
            raw_id = str(node)
        except Exception:
            pass

    # 4. Hostname fallback
    if not raw_id:
        try:
            import socket

            raw_id = socket.gethostname()
        except Exception:
            raw_id = "default-fallback"

    digest = hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:8]
    return f"{prefix}-{digest}"


def _extract_overlay_id() -> str | None:
    mountinfo = Path("/proc/1/mountinfo")
    if not mountinfo.is_file():
        return None
    try:
        content = mountinfo.read_text(encoding="utf-8")
        for line in content.splitlines():
            if "upperdir=" not in line:
                continue
            m = re.search(r"upperdir=([^,]+)", line)
            if not m:
                continue
            parts = m.group(1).rstrip("/").split("/")
            for part in reversed(parts):
                if len(part) >= 32 and all(c in "0123456789abcdef" for c in part):
                    return part
    except Exception:
        pass
    return None


def _get_windows_machine_guid() -> str:
    try:
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY
        )
        value, _ = winreg.QueryValueEx(key, "MachineGuid")
        winreg.CloseKey(key)
        return str(value).strip()
    except Exception:
        pass
    return ""


def _get_macos_hardware_uuid() -> str:
    try:
        out = subprocess.check_output(
            ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"], stderr=subprocess.DEVNULL, text=True, timeout=2.0
        )
        m = re.search(r'"IOPlatformUUID" = "([^"]+)"', out)
        if m:
            return m.group(1).strip()
    except Exception:
        pass
    return ""


def _get_linux_machine_id() -> str:
    for path_str in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        p = Path(path_str)
        if p.is_file():
            try:
                content = p.read_text(encoding="utf-8").strip()
                if content:
                    return content
            except Exception:
                pass
    return ""


def find_nmem_binary() -> str | None:
    """Locate nmem binary on PATH or via uvx."""
    found = shutil.which("nmem")
    if found:
        return found
    return None


def run_nmem_command(
    args: list[str],
    timeout: float = 3.0,
    cwd: str | Path | None = None,
) -> subprocess.CompletedProcess | None:
    """Run nmem CLI command if available."""
    binary = find_nmem_binary()
    if not binary:
        # Check uvx fallback
        if shutil.which("uvx"):
            cmd = ["uvx", "--from", "nmem-cli", "nmem"] + args
        else:
            return None
    else:
        cmd = [binary] + args

    kwargs: dict[str, Any] = {
        "capture_output": True,
        "text": True,
        "encoding": "utf-8",
        "errors": "replace",
        "timeout": timeout,
        "check": False,
    }
    if cwd:
        kwargs["cwd"] = str(cwd)
    if sys.platform == "win32":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

    try:
        return subprocess.run(cmd, **kwargs)
    except (OSError, subprocess.TimeoutExpired):
        return None


def resolve_space(cwd: str | Path | None = None) -> str:
    """Resolve active space following precedence:
    1. NMEM_SPACE or NMEM_SPACE_ID environment variable
    2. .nmemspace or .nowledge/config.json or .config.json
    3. Workspace directory name if matching an active space on server
    4. Default (empty string)
    """
    env_space = os.environ.get("NMEM_SPACE", "").strip() or os.environ.get("NMEM_SPACE_ID", "").strip()
    if env_space:
        return env_space

    target_dir = Path(cwd).resolve() if cwd else Path.cwd().resolve()
    for candidate in (
        target_dir / ".nmemspace",
        target_dir / ".nowledge" / "space",
    ):
        if candidate.is_file():
            try:
                val = candidate.read_text(encoding="utf-8").strip()
                if val:
                    return val
            except Exception:
                pass

    local_cfg = get_local_config(cwd)
    cfg_space = str(local_cfg.get("space") or local_cfg.get("spaceId") or "").strip()
    if cfg_space:
        return cfg_space

    return ""


def resolve_agent_id() -> str:
    """Resolve multi-agent identity for OpenHands worker nodes:
    1. NMEM_AGENT_ID (e.g. planner, coder, reviewer, researcher, orchestrator)
    2. OPENHANDS_AGENT_NAME or AGENT_NAME
    3. Empty string
    """
    return (
        os.environ.get("NMEM_AGENT_ID", "").strip()
        or os.environ.get("OPENHANDS_AGENT_NAME", "").strip()
        or os.environ.get("AGENT_NAME", "").strip()
    )


def read_startup_context(cwd: str | Path | None = None) -> dict[str, str] | None:
    """Fetch startup context (Context Bundle preferred, Working Memory fallback)."""
    space = resolve_space(cwd)
    agent_id = resolve_agent_id()
    host_agent_id = os.environ.get("NMEM_HOST_AGENT_ID", "").strip() or get_host_agent_fingerprint()

    # 1. Try direct HTTP Context Bundle
    query_params: dict[str, str] = {"source_app": "openhands"}
    if space:
        query_params["space_id"] = space
        query_params["space"] = space
    if agent_id:
        query_params["agent_id"] = agent_id
    if host_agent_id:
        query_params["host_agent_id"] = host_agent_id

    def _extract_bundle(d: dict[str, Any] | None) -> dict[str, str] | None:
        if isinstance(d, dict):
            for key in ("rendered_markdown", "markdown", "content"):
                val = d.get(key)
                if isinstance(val, str) and val.strip():
                    return {"tag": "nowledge_context_bundle", "label": "Context Bundle", "content": val.strip()}
        return None

    qs = urllib.parse.urlencode(query_params)
    for endpoint in (f"/context/bundle?{qs}", f"/context?{qs}"):
        bundle = _extract_bundle(http_request(endpoint, method="GET", timeout=1.5, cwd=cwd))
        if bundle:
            return bundle

    # 2. Try direct HTTP Working Memory
    wm_params = {"space_id": space, "space": space} if space else {}
    wm_qs = f"?{urllib.parse.urlencode(wm_params)}" if wm_params else ""
    for wm_endpoint in (f"/agent/working-memory{wm_qs}", f"/working-memory{wm_qs}"):
        res_wm = http_request(wm_endpoint, method="GET", timeout=1.5, cwd=cwd)
        if isinstance(res_wm, dict) and isinstance(res_wm.get("content"), str) and res_wm["content"].strip():
            return {"tag": "nowledge_working_memory", "label": "Working Memory", "content": res_wm["content"].strip()}

    # 3. CLI fallback for context
    cli_args = ["--json", "context", "--source-app", "openhands"]
    if space:
        cli_args.extend(["--space", space])
    if agent_id:
        cli_args.extend(["--agent-id", agent_id])
    if host_agent_id:
        cli_args.extend(["--host-agent-id", host_agent_id])

    proc = run_nmem_command(cli_args, timeout=2.5)
    if proc and proc.returncode == 0:
        try:
            bundle = _extract_bundle(json.loads(proc.stdout or "{}"))
            if bundle:
                return bundle
        except Exception:
            pass

    # 4. CLI fallback for working-memory
    wm_cli_args = ["--json", "wm", "read"]
    if space:
        wm_cli_args.extend(["--space", space])
    proc_wm = run_nmem_command(wm_cli_args, timeout=2.5)
    if proc_wm and proc_wm.returncode == 0:
        try:
            data = json.loads(proc_wm.stdout or "{}")
            if isinstance(data.get("content"), str) and data["content"].strip():
                return {"tag": "nowledge_working_memory", "label": "Working Memory", "content": data["content"].strip()}
        except Exception:
            pass

    # 5. Legacy Working Memory file
    legacy_path = Path("~/ai-now/memory.md").expanduser()
    if legacy_path.is_file():
        try:
            content = legacy_path.read_text(encoding="utf-8").strip()
            if content:
                return {"tag": "nowledge_working_memory", "label": "legacy Working Memory file", "content": content}
        except Exception:
            pass

    return None


def build_mcp_config(cwd: str | Path | None = None) -> dict[str, Any]:
    """Build MCP configuration dictionary for OpenHands SDK Agent or mcp.json."""
    api_url, api_key = get_effective_config(cwd)
    clean_url = api_url.rstrip("/")
    server_url = f"{clean_url}/mcp"
    headers = _make_auth_headers(api_key)

    target_server: dict[str, Any] = {"type": "http", "url": server_url}
    if api_key or not (clean_url.startswith("http://127.0.0.1") or clean_url.startswith("http://localhost")):
        target_server["headers"] = headers

    return {"mcpServers": {"nowledge-mem": target_server}}


def sync_mcp_config_file(mcp_config_path: str | Path | None = None, cwd: str | Path | None = None) -> bool:
    """Synchronize OpenHands .mcp.json or mcp.json with effective client configuration
    (~/.nowledge-mem/config.json or NMEM_API_URL/NMEM_API_KEY env vars), preserving any existing servers.
    Returns True if configuration was updated, False if already up to date.
    """
    target_data = build_mcp_config(cwd)
    target_server = target_data["mcpServers"]["nowledge-mem"]

    paths_to_sync: list[Path] = []
    if mcp_config_path:
        paths_to_sync.append(Path(mcp_config_path).resolve())
    else:
        target_dir = Path(cwd).resolve() if cwd else Path.cwd().resolve()
        openhands_dir_mcp = target_dir / ".openhands" / "mcp.json"
        if openhands_dir_mcp.parent.is_dir():
            paths_to_sync.append(openhands_dir_mcp)

    updated = False
    for p in paths_to_sync:
        current_data = None
        if p.exists():
            try:
                current_data = json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                pass
        merged_data = dict(current_data) if isinstance(current_data, dict) else {}
        servers = dict(merged_data.get("mcpServers")) if isinstance(merged_data.get("mcpServers"), dict) else {}
        if servers.get("nowledge-mem") != target_server:
            servers["nowledge-mem"] = target_server
            merged_data["mcpServers"] = servers
            try:
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(json.dumps(merged_data, indent=2) + "\n", encoding="utf-8")
                updated = True
            except Exception:
                pass
    return updated


def find_conversation_dir(session_id: str, working_dir: str | Path | None = None) -> Path | None:
    """Locate the OpenHands conversation events directory on disk."""
    if not session_id:
        return None
    raw_id = session_id.strip()
    if raw_id.startswith("openhands-"):
        raw_id = raw_id[len("openhands-"):]
    id_no_dashes = raw_id.replace("-", "")

    candidates: list[Path] = []

    for env_k in ("OPENHANDS_CONVERSATIONS_PATH", "OPENHANDS_PERSISTENCE_DIR", "OH_PERSISTENCE_DIR"):
        env_path = os.environ.get(env_k, "").strip()
        if env_path:
            ep = Path(env_path).resolve()
            candidates.extend([
                ep / raw_id,
                ep / id_no_dashes,
                ep / "conversations" / raw_id,
                ep / "conversations" / id_no_dashes,
                ep,
            ])

    if working_dir:
        cwd_p = Path(working_dir).resolve()
        candidates.extend([
            cwd_p / "workspace" / "conversations" / raw_id,
            cwd_p / "workspace" / "conversations" / id_no_dashes,
            cwd_p / ".openhands" / "conversations" / raw_id,
            cwd_p / ".openhands" / "conversations" / id_no_dashes,
            cwd_p / ".openhands" / raw_id,
            cwd_p / ".openhands" / id_no_dashes,
        ])

    home = Path.home()
    patterns = [
        str(home / ".local/share/openhands/agents/*/workspace/conversations" / raw_id),
        str(home / ".local/share/openhands/agents/*/workspace/conversations" / id_no_dashes),
        str(home / ".openhands/conversations" / raw_id),
        str(home / ".openhands/conversations" / id_no_dashes),
        str(home / ".openhands/workspace/conversations" / raw_id),
        str(home / ".openhands/workspace/conversations" / id_no_dashes),
        str(home / ".local/share/openhands/canvas/conversations" / raw_id),
        str(home / ".local/share/openhands/canvas/conversations" / id_no_dashes),
    ]
    for pat in patterns:
        for match in glob.glob(pat):
            candidates.append(Path(match))

    for cand in candidates:
        if cand.is_dir() and (cand / "events").is_dir():
            return cand.resolve()
    return None


def parse_openhands_events(conv_dir: str | Path) -> tuple[str | None, list[dict[str, str]]]:
    """Parse OpenHands conversation event JSON files into clean (title, messages) tuples.
    
    Extracts MessageEvent, ActionEvent (conversational responses / finish actions),
    and ObservationEvent (finish observations), while omitting internal raw execution details.
    """
    path = Path(conv_dir)
    events_dir = path / "events"
    if not events_dir.is_dir():
        return None, []

    title: str | None = None
    meta_path = path / "meta.json"
    if meta_path.is_file():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if isinstance(meta, dict):
                raw_title = meta.get("title")
                if raw_title and isinstance(raw_title, str) and raw_title.strip():
                    title = raw_title.strip()
        except Exception:
            pass

    event_files = sorted(events_dir.glob("event-*.json"))
    messages: list[dict[str, str]] = []

    def _extract_text(content: Any) -> str:
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = [c.get("text", "") for c in content if isinstance(c, dict) and "text" in c]
            return "".join(parts).strip()
        return ""

    def _append_message(role: str, text: str) -> None:
        nonlocal title
        if not text:
            return
        if not title and role == "user":
            first_line = text.splitlines()[0].strip()
            title = first_line[:60] if len(first_line) > 60 else first_line
        if not messages or messages[-1]["role"] != role or messages[-1]["content"] != text:
            messages.append({"role": role, "content": text})

    for ef in event_files:
        try:
            d = json.loads(ef.read_text(encoding="utf-8"))
        except Exception:
            continue

        kind = d.get("kind")
        source = d.get("source")

        if kind == "MessageEvent":
            llm_msg = d.get("llm_message", {})
            role = llm_msg.get("role", "user" if source == "user" else "assistant")
            _append_message(role, _extract_text(llm_msg.get("content")))

        elif kind == "ObservationEvent":
            obs = d.get("observation") or {}
            if obs.get("kind") == "FinishObservation" or source == "agent":
                _append_message("assistant", _extract_text(obs.get("content")))

        elif kind == "ActionEvent":
            act = d.get("action") or {}
            if act.get("kind") in ("MessageAction", "FinishAction") or ("message" in act and not act.get("command")):
                msg = act.get("message")
                if isinstance(msg, str):
                    _append_message("assistant", msg.strip())

    return title, messages


def sync_openhands_thread(
    session_id: str,
    working_dir: str | Path | None = None,
    space: str | None = None,
    agent_id: str | None = None,
    hook_input: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Sync OpenHands conversation session into Nowledge Mem thread via REST API or CLI.
    
    Follows the 3-tier architecture:
    1. Parse native OpenHands events from disk.
    2. POST /threads/import to Nowledge Mem REST API (<30ms).
    3. CLI fallback via `nmem t import`.
    4. Offline fallback buffered into FileLocked unsynced queue.
    """
    if not session_id:
        return None

    clean_id = session_id.strip()
    if clean_id.startswith("openhands-"):
        clean_id = clean_id[len("openhands-"):].strip()
    thread_id = f"openhands-{clean_id}"

    # 1. Locate conversation directory and parse events
    conv_dir = find_conversation_dir(clean_id, working_dir=working_dir)
    title: str | None = None
    messages: list[dict[str, str]] = []

    if conv_dir:
        title, messages = parse_openhands_events(conv_dir)

    # Fallback if no events file was parsed but hook_input has message
    if not messages and hook_input:
        msg_text = hook_input.get("message") or hook_input.get("summary")
        if msg_text and isinstance(msg_text, str) and msg_text.strip():
            messages = [{"role": "user", "content": msg_text.strip()}]
            if not title:
                title = msg_text.strip().splitlines()[0][:60]

    if not messages:
        return None

    if not title:
        title = f"OpenHands Session {clean_id[:8]}"

    payload: dict[str, Any] = {
        "thread_id": thread_id,
        "title": title,
        "messages": messages,
        "source": "openhands",
    }
    metadata: dict[str, Any] = {}
    if space:
        payload["space"] = space
        metadata["space_id"] = space
    if agent_id:
        payload["agent_id"] = agent_id
        metadata["agent_id"] = agent_id
    if metadata:
        payload["metadata"] = metadata

    # 2. Try fast direct HTTP REST import
    if not is_backend_unreachable():
        res = http_request("/threads/import", method="POST", body=payload, timeout=3.0, cwd=working_dir)
        if isinstance(res, dict) and res.get("success") is True and not res.get("failed_count"):
            return res

    # 3. Try CLI fallback with `nmem --json t import`
    cli_cmd = [
        "--json",
        "t", "import",
        "--id", thread_id,
        "--title", title,
        "--messages", json.dumps(messages),
        "--source", "openhands",
    ]
    if space:
        cli_cmd.extend(["--space", space])
    if agent_id:
        cli_cmd.extend(["--agent-id", agent_id])

    proc = run_nmem_command(cli_cmd, timeout=4.0, cwd=working_dir)
    if proc and proc.returncode == 0:
        try:
            cli_res = json.loads(proc.stdout)
            if isinstance(cli_res, dict) and cli_res.get("success") is True and not cli_res.get("failed_count"):
                return cli_res
        except Exception:
            pass

    # 4. Offline or unreachable -> buffer in unsynced queue
    save_unsynced_session(clean_id, payload, cwd=working_dir)
    return None


class FileLock:
    def __init__(self, path: Path, timeout: float = 3.0):
        self.lock_path = path.with_suffix(path.suffix + ".lock")
        self.timeout = timeout
        self.acquired = False

    def __enter__(self):
        import time

        deadline = time.time() + self.timeout
        while True:
            try:
                fd = os.open(self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                try:
                    os.write(fd, str(os.getpid()).encode("utf-8"))
                finally:
                    os.close(fd)
                self.acquired = True
                return self
            except FileExistsError:
                if time.time() >= deadline:
                    break
                try:
                    if self.lock_path.exists():
                        content = self.lock_path.read_text(encoding="utf-8").strip()
                        owner_pid = int(content) if content.isdigit() else 0
                        if owner_pid > 0 and not _is_pid_alive(owner_pid):
                            self.lock_path.unlink(missing_ok=True)
                            continue
                        elif owner_pid == 0 and (time.time() - self.lock_path.stat().st_mtime) > 10.0:
                            self.lock_path.unlink(missing_ok=True)
                            continue
                except Exception:
                    pass
                time.sleep(0.05)
        raise TimeoutError(f"Could not acquire lock for {self.lock_path} within {self.timeout}s")

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.acquired:
            try:
                self.lock_path.unlink(missing_ok=True)
            except Exception:
                pass


def _is_pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def get_unsynced_queue_path() -> Path:
    queue_dir = Path("~/.nowledge-mem/plugins/openhands").expanduser()
    queue_dir.mkdir(parents=True, exist_ok=True)
    return queue_dir / "unsynced.json"


def save_unsynced_session(session_id: str, payload: dict[str, Any], cwd: str | Path | None = None) -> bool:
    queue_path = get_unsynced_queue_path()
    eff_url, _ = get_effective_config(cwd)
    endpoint_url = eff_url.rstrip("/")
    try:
        with FileLock(queue_path, timeout=2.0):
            data = {}
            if queue_path.exists():
                try:
                    data = json.loads(queue_path.read_text(encoding="utf-8"))
                except Exception:
                    data = {}
            if not isinstance(data, dict):
                data = {}
            data[session_id] = {
                "payload": payload,
                "endpoint_url": endpoint_url,
                "timestamp": time.time(),
            }
            queue_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
            return True
    except TimeoutError:
        return False
    except Exception:
        return False


def flush_unsynced_sessions(cwd: str | Path | None = None) -> int:
    """Synchronously drain unsynced sessions buffer by retrying direct HTTP imports.
    Strictly partitions replay by destination endpoint_url to prevent cross-endpoint transcript leak.
    """
    if is_backend_unreachable():
        return 0

    queue_path = get_unsynced_queue_path()
    if not queue_path.exists():
        return 0

    flushed = 0
    eff_url, _ = get_effective_config(cwd)
    current_endpoint = eff_url.rstrip("/")

    try:
        with FileLock(queue_path, timeout=2.0):
            if not queue_path.exists():
                return 0
            try:
                data = json.loads(queue_path.read_text(encoding="utf-8"))
            except Exception:
                return 0
            if not isinstance(data, dict) or not data:
                return 0

            remaining: dict[str, Any] = {}
            for conv_id, item in data.items():
                dest = item.get("endpoint_url")
                # If destination is specified, only replay when it matches current endpoint
                if dest and dest.rstrip("/") != current_endpoint:
                    remaining[conv_id] = item
                    continue

                payload = item.get("payload", {})
                res = http_request("/threads/import", method="POST", body=payload, timeout=3.0, cwd=cwd)
                if isinstance(res, dict) and res.get("success") is True and not res.get("failed_count"):
                    flushed += 1
                else:
                    remaining[conv_id] = item

            try:
                if remaining:
                    queue_path.write_text(json.dumps(remaining, indent=2) + "\n", encoding="utf-8")
                else:
                    queue_path.unlink(missing_ok=True)
            except Exception:
                pass
    except TimeoutError:
        return 0
    return flushed


def retry_unsynced_sessions(cwd: str | Path | None = None) -> int:
    return flush_unsynced_sessions(cwd)


def retry_unsynced_sessions_async(cwd: str | Path | None = None) -> None:
    import threading

    t = threading.Thread(target=flush_unsynced_sessions, args=(cwd,), daemon=True)
    t.start()


def sync_host_skills_async() -> None:
    """Non-blocking background sync of skills connections."""
    import threading

    def _sync():
        try:
            run_nmem_command(["skills", "connect", "openhands"], timeout=4.0)
            run_nmem_command(["skills", "sync"], timeout=5.0)
        except Exception:
            pass

    t = threading.Thread(target=_sync, daemon=True)
    t.start()
