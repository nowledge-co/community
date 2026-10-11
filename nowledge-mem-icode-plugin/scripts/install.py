#!/usr/bin/env python3
"""Install Nowledge Mem for iCode (Chrys).

iCode has no plugin marketplace. This installer wires the three surfaces iCode
does expose:

1. MCP server block merged into ``<config>/agents/<Agent>.yaml`` under
   ``tools.mcp`` (iCode loads MCP through agent profiles).
2. A ``user_prompt_submit`` hook merged into ``<config>/hooks/hooks.yaml`` that
   injects the Nowledge Mem Context Bundle on the first prompt of a session
   and a recall/save reminder afterwards. The hook script is copied to
   ``<config>/hooks/scripts/`` so the install survives repo cleanup.
3. Shared skills copied into ``~/.agents/skills/``, which iCode reads by
   default.

The installer is idempotent: re-running it after an update replaces the
managed entries in place. ``--remove`` reverses everything it created, using
the manifest written at ``<config>/nowledge-mem-icode-install.json``.

Credentials come from ``~/.nowledge-mem/config.json`` (``apiUrl``/``apiKey``)
or ``NMEM_API_URL``/``NMEM_API_KEY``. The key is written into the agent
profile YAML (same trust level as iCode's own config) and is never printed.

PyYAML is required for automated installation. Without it, preview blocks
are printed and no files are changed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
PLUGIN_VERSION = "0.1.0"

SERVER_NAME = "nowledge-mem"
HOOK_ID = "nowledge-mem-icode-context"
HOOK_SCRIPT_NAME = "nmem_icode_hook.py"
MANIFEST_NAME = "nowledge-mem-icode-install.json"

SKILL_NAMES = (
    "read-working-memory",
    "search-memory",
    "distill-memory",
    "save-handoff",
    "check-integration",
    "status",
)

ALWAYS_LOAD_TOOLS = (
    "memory_search",
    "memory_add",
    "memory_update",
    "read_context_bundle",
)

BASE_HEADERS = (
    ("APP", "iCode"),
    ("x-nmem-space-protocol", "exact-v1"),
    ("X-Nmem-Tool-Set", "external-agent"),
    ("X-Nowledge-Tool-Schema-Profile", "slim"),
)


def _config_dir(flag_value: str | None) -> Path:
    if flag_value:
        return Path(flag_value).expanduser()
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        if appdata:
            return Path(appdata) / "chrys"
        return Path.home() / "AppData" / "Roaming" / "chrys"
    return Path.home() / ".chrys"


def _nmem_config_path() -> Path:
    if os.environ.get("NMEM_CLI_CONFIG_DIR"):
        return Path(os.environ["NMEM_CLI_CONFIG_DIR"]).expanduser() / "config.json"
    if sys.platform == "win32":
        return Path.home() / "AppData" / "Roaming" / ".nowledge-mem" / "config.json"
    return Path.home() / ".nowledge-mem" / "config.json"


def _resolve_endpoint() -> tuple[str, str | None]:
    """Return (api_url, api_key). api_key may be None for keyless local Mem."""
    api_url = os.environ.get("NMEM_API_URL", "").strip().rstrip("/")
    api_key = os.environ.get("NMEM_API_KEY", "").strip() or None
    cfg_path = _nmem_config_path()
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cfg = {}
    if not isinstance(cfg, dict):
        raise SystemExit("Mem config must be a JSON object")
    configured_url = str(cfg.get("apiUrl") or "").strip().rstrip("/")
    if api_url and api_url != configured_url and cfg.get("apiKey") and not api_key:
        raise SystemExit("Endpoint override requires its own NMEM_API_KEY; refusing to reuse a different endpoint's key")
    if not api_url:
        api_url = str(cfg.get("apiUrl", "")).strip().rstrip("/")
    if api_key is None:
        api_key = str(cfg.get("apiKey") or "").strip() or None
    if not api_url:
        api_url = "http://127.0.0.1:14242"
    parsed = urlsplit(api_url)
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or (parsed.scheme == "http" and not local)):
        raise SystemExit("Use a Mem base URL with HTTPS, or HTTP on loopback; no embedded credentials/query/fragment")
    if not local and not api_key:
        raise SystemExit("Remote Mem requires its matching API key; configure nmem or NMEM_API_KEY first")
    return api_url, api_key


def _backup(path: Path) -> Path | None:
    if not path.exists():
        return None
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    target = path.with_name(f"{path.name}.{stamp}.nmem-bak")
    shutil.copy2(path, target)
    target.chmod(0o600)
    return target


def _yaml() -> "object | None":
    try:
        import yaml  # type: ignore[import-not-found]

        return yaml
    except ImportError:
        return None


def _mcp_entry(api_url: str, api_key: str | None) -> dict:
    headers: dict[str, str] = dict(BASE_HEADERS)
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        headers["X-NMEM-API-Key"] = api_key
    return {
        "name": SERVER_NAME,
        "transport": "http",
        "url": f"{api_url}/mcp",
        "description": "Nowledge Mem (nmem) memory server",
        "timeout": 120,
        "bypass_proxy": True,
        "use_progressive_disclosure": True,
        "always_load": list(ALWAYS_LOAD_TOOLS),
        "headers": headers,
    }


def _hook_entry() -> dict:
    return {
        "id": HOOK_ID,
        "event": "user_prompt_submit",
        "run": {
            "type": "script",
            "path": f"scripts/{HOOK_SCRIPT_NAME}",
        },
        "execution": {
            "mode": "blocking",
            "timeout_seconds": 10,
        },
        "description": (
            "Nowledge Mem: inject the Context Bundle on the first prompt of a "
            "session and a recall/save reminder afterwards"
        ),
    }


def _merge_agent_profile(path: Path, agent: str, entry: dict) -> list[str]:
    """Merge the MCP entry into <config>/agents/<Agent>.yaml. Returns notes."""
    yaml = _yaml()
    notes: list[str] = []
    if yaml is None:
        notes.append(
            f"PyYAML not found: merge this block into {path} under tools: mcp: manually"
        )
        return notes

    data = {}
    if path.exists():
        loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
        if loaded is not None:
            if not isinstance(loaded, dict):
                raise SystemExit(f"refusing to edit non-mapping agent profile: {path}")
            data = loaded

    tools = data.setdefault("tools", {})
    if tools is None or not isinstance(tools, dict):
        raise SystemExit(f"unexpected tools section in {path}; edit manually")
    servers = tools.setdefault("mcp", [])
    if servers is None:
        servers = []
        tools["mcp"] = servers
    if not isinstance(servers, list):
        raise SystemExit(f"unexpected tools.mcp section in {path}; edit manually")

    kept = [s for s in servers if not (isinstance(s, dict) and s.get("name") == SERVER_NAME)]
    if len(kept) != len(servers):
        notes.append(f"replaced previous {SERVER_NAME} MCP entry in {path.name}")
    kept.append(entry)
    tools["mcp"] = kept

    path.parent.mkdir(parents=True, exist_ok=True)
    backup = _backup(path)
    if backup:
        notes.append(f"backup: {backup.name}")
    path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    notes.append(f"merged {SERVER_NAME} MCP server into {path} (agent: {agent})")
    return notes


def _merge_hooks_file(path: Path, entry: dict) -> list[str]:
    yaml = _yaml()
    notes: list[str] = []
    if yaml is None:
        notes.append(
            f"PyYAML not found: merge this block into {path} under hooks: manually"
        )
        return notes

    data: dict = {}
    if path.exists():
        loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
        if loaded is not None:
            if not isinstance(loaded, dict):
                raise SystemExit(f"refusing to edit non-mapping hooks file: {path}")
            data = loaded

    hooks = data.setdefault("hooks", [])
    if hooks is None:
        hooks = []
        data["hooks"] = hooks
    if not isinstance(hooks, list):
        raise SystemExit(f"unexpected hooks section in {path}; edit manually")

    kept = [h for h in hooks if not (isinstance(h, dict) and h.get("id") == HOOK_ID)]
    if len(kept) != len(hooks):
        notes.append(f"replaced previous {HOOK_ID} hook entry")
    for other in kept:
        if isinstance(other, dict) and other.get("id") == HOOK_ID:
            raise SystemExit(f"duplicate hook id {HOOK_ID!r} already present")
    kept.append(entry)
    data["hooks"] = kept

    path.parent.mkdir(parents=True, exist_ok=True)
    backup = _backup(path)
    if backup:
        notes.append(f"backup: {backup.name}")
    path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    notes.append(f"merged {HOOK_ID} hook into {path}")
    return notes


def _fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    files = sorted(path.rglob("*")) if path.is_dir() else [path]
    for file in files:
        if file.is_symlink():
            raise SystemExit(f"refusing to manage symlink: {file}")
        if file.is_file():
            digest.update(str(file.relative_to(path) if path.is_dir() else file.name).encode())
            digest.update(file.read_bytes())
    return digest.hexdigest()


def _install_asset(src: Path, dst: Path, managed: dict, force: bool) -> str:
    key = str(dst)
    record = managed.get(key)
    if dst.is_symlink():
        raise SystemExit(f"refusing to replace symlink: {dst}")
    if dst.exists():
        unchanged = record and _fingerprint(dst) == record["digest"]
        if not unchanged and not force:
            return f"kept existing/user-edited asset: {dst}"
        if not unchanged:
            backup = dst.with_name(f"{dst.name}.{uuid4().hex}.nmem-bak")
            if dst.is_dir():
                shutil.copytree(dst, backup)
            else:
                shutil.copy2(dst, backup)
            record = {"backup": str(backup)}
        if dst.is_dir():
            shutil.rmtree(dst)
    record = record or {"backup": None}
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dst)
    else:
        shutil.copy2(src, dst)
    record["digest"] = _fingerprint(dst)
    managed[key] = record
    return f"installed managed asset: {dst}"


def _write_manifest(config_dir: Path, created: dict, managed: dict,
                    originals: dict, installed: dict) -> None:
    manifest = {
        "plugin": "nowledge-mem-icode-plugin",
        "version": PLUGIN_VERSION,
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "created": created,
        "managed": managed,
        "originals": originals,
        "installed": installed,
    }
    path = config_dir / MANIFEST_NAME
    with path.open("w", encoding="utf-8") as file:
        path.chmod(0o600)
        file.write(json.dumps(manifest, indent=2) + "\n")


def _print_manual_blocks(api_url: str, agent: str) -> None:
    yaml = _yaml()
    entry = _mcp_entry(api_url, "<your-api-key>")
    hook = _hook_entry()
    print("\nManual configuration blocks:\n")
    print(f"1) {agent} profile (tools.mcp):")
    if yaml:
        print(yaml.safe_dump([entry], sort_keys=False).strip())
    else:
        print(json.dumps([entry], indent=2))
    print("\n2) hooks.yaml (hooks list):")
    if yaml:
        print(yaml.safe_dump([hook], sort_keys=False).strip())
    else:
        print(json.dumps([hook], indent=2))


def install(args: argparse.Namespace) -> int:
    config_dir = _config_dir(args.config_dir)
    agents_dir = config_dir / "agents"
    hooks_dir = config_dir / "hooks"
    skills_root = Path(args.skills_root).expanduser() if args.skills_root else Path.home() / ".agents" / "skills"

    agent = args.agent
    if not agent or any(c in agent for c in '/\\:*?"<>|') or agent in {".", ".."}:
        raise SystemExit(f"invalid agent name: {agent!r}")

    api_url, api_key = _resolve_endpoint()
    if not api_key:
        print("note: no API key found (local keyless Mem assumed)")

    profile_path = agents_dir / f"{agent}.yaml"
    if args.dry_run or _yaml() is None:
        print("Preview only: no files modified. Install PyYAML for automated setup.")
        _print_manual_blocks(api_url, agent)
        return 0
    if not profile_path.exists():
        raise SystemExit(f"Open iCode /agents and save the {agent} profile first, then rerun. Refusing to create an incomplete profile: {profile_path}")

    yaml = _yaml()
    hooks_path = hooks_dir / "hooks.yaml"
    profile = yaml.safe_load(profile_path.read_text(encoding="utf-8"))
    hooks_data = yaml.safe_load(hooks_path.read_text(encoding="utf-8")) if hooks_path.exists() else {}
    hooks_data = hooks_data or {}
    if not isinstance(profile, dict) or not isinstance(profile.get("tools", {}), dict):
        raise SystemExit("Agent profile/tools must be mappings")
    if not isinstance(profile.get("name"), str) or not profile["name"].strip():
        raise SystemExit("Agent profile must contain its name; save the profile in iCode first")
    servers = profile.get("tools", {}).get("mcp", [])
    hooks = hooks_data.get("hooks", []) if isinstance(hooks_data, dict) else None
    servers = [] if servers is None else servers
    hooks = [] if hooks is None and isinstance(hooks_data, dict) else hooks
    if not isinstance(servers, list) or not isinstance(hooks, list):
        raise SystemExit("MCP servers and hooks must be lists")
    manifest_path = config_dir / MANIFEST_NAME
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    if previous and "managed" not in previous:
        raise SystemExit("This old install manifest has no ownership receipts; inspect its backups before reinstalling")
    if previous and previous.get("created", {}).get("agent_profile") != str(profile_path):
        raise SystemExit("Remove the managed agent installation before selecting another profile")
    if previous and previous.get("created", {}).get("skills_root") != str(skills_root):
        raise SystemExit("Remove the installation before selecting another skills root")
    if previous and not args.force:
        installed = previous.get("installed", {})
        current_mcp = [s for s in servers if isinstance(s, dict) and s.get("name") == SERVER_NAME]
        current_hook = [h for h in hooks if isinstance(h, dict) and h.get("id") == HOOK_ID]
        if current_mcp != [installed.get("mcp")] or current_hook != [installed.get("hook")]:
            raise SystemExit("Managed MCP/hook configuration was edited; inspect backups before using --force")
    managed = previous.get("managed", {})
    originals = previous.get("originals", {
        "mcp": [s for s in servers if isinstance(s, dict) and s.get("name") == SERVER_NAME],
        "hook": [h for h in hooks if isinstance(h, dict) and h.get("id") == HOOK_ID],
    })

    created: dict[str, object] = {
        "config_dir": str(config_dir),
        "agent": agent,
        "agent_profile": str(profile_path),
        "hooks_file": str(hooks_dir / "hooks.yaml"),
        "hook_script": str(hooks_dir / "scripts" / HOOK_SCRIPT_NAME),
        "skills_root": str(skills_root),
        "skills": [],
    }

    notes: list[str] = []
    notes.append(_install_asset(PLUGIN_ROOT / "hooks" / HOOK_SCRIPT_NAME,
                                hooks_dir / "scripts" / HOOK_SCRIPT_NAME, managed, args.force))
    for name in SKILL_NAMES:
        notes.append(_install_asset(PLUGIN_ROOT / "skills" / name, skills_root / name, managed, args.force))

    notes += _merge_agent_profile(profile_path, agent, _mcp_entry(api_url, api_key))
    notes += _merge_hooks_file(hooks_dir / "hooks.yaml", _hook_entry())
    _write_manifest(config_dir, created, managed, originals,
                    {"mcp": _mcp_entry(api_url, api_key), "hook": _hook_entry()})
    # These files may contain the remote bearer key or the prior MCP entry.
    profile_path.chmod(0o600)
    manifest_path.chmod(0o600)

    for note in notes:
        print(f"- {note}")
    print(
        "\nDone. Restart iCode (agent profiles and hooks load at startup), then "
        "verify: /agents > MCP tab shows 'nowledge-mem', and the first prompt of "
        "a new session carries the Nowledge Mem context reminder."
    )
    return 0


def remove(args: argparse.Namespace) -> int:
    config_dir = _config_dir(args.config_dir)
    manifest_path = config_dir / MANIFEST_NAME
    if not manifest_path.exists():
        raise SystemExit(f"no install manifest at {manifest_path}; nothing to remove")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    created = manifest.get("created", {})
    if not all(key in manifest for key in ("managed", "installed", "originals")):
        raise SystemExit("Manifest has no ownership receipts; inspect its backups before manual removal")
    agent = created.get("agent", "")
    profile_path = config_dir / "agents" / f"{agent}.yaml"
    hooks_file = config_dir / "hooks" / "hooks.yaml"
    if (not agent or any(c in agent for c in '/\\:*?"<>|')
            or created.get("agent_profile") != str(profile_path)
            or created.get("hooks_file") != str(hooks_file)):
        raise SystemExit("Manifest includes unexpected configuration paths; refusing removal")
    skills_root = Path(created["skills_root"])
    allowed = {str(skills_root / name) for name in SKILL_NAMES}
    allowed.add(str(config_dir / "hooks" / "scripts" / HOOK_SCRIPT_NAME))
    for key, record in manifest["managed"].items():
        if key not in allowed:
            raise SystemExit("Manifest includes an unexpected asset; refusing removal")
        if record.get("backup") and not Path(record["backup"]).exists():
            raise SystemExit("An asset backup is missing; restore it before removal")

    yaml = _yaml()
    if yaml is None:
        raise SystemExit("Install PyYAML before removal; no files were modified")
    notes: list[str] = []

    if yaml and profile_path.exists():
        data = yaml.safe_load(profile_path.read_text(encoding="utf-8")) or {}
        tools = data.get("tools") or {}
        servers = tools.get("mcp")
        if isinstance(servers, list):
            installed = manifest.get("installed", {}).get("mcp")
            kept = [s for s in servers if s != installed]
            if len(kept) != len(servers):
                tools["mcp"] = kept + manifest.get("originals", {}).get("mcp", [])
                _backup(profile_path)
                profile_path.write_text(
                    yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
                    encoding="utf-8",
                )
                notes.append(f"removed {SERVER_NAME} from {profile_path.name}")

    if yaml and hooks_file.exists():
        data = yaml.safe_load(hooks_file.read_text(encoding="utf-8")) or {}
        hooks = data.get("hooks")
        if isinstance(hooks, list):
            installed = manifest.get("installed", {}).get("hook")
            kept = [h for h in hooks if h != installed]
            if len(kept) != len(hooks):
                data["hooks"] = kept + manifest.get("originals", {}).get("hook", [])
                _backup(hooks_file)
                hooks_file.write_text(
                    yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
                    encoding="utf-8",
                )
                notes.append(f"removed {HOOK_ID} from {hooks_file.name}")

    for key, record in manifest.get("managed", {}).items():
        path = Path(key)
        if not path.exists():
            continue
        if path.is_symlink() or _fingerprint(path) != record["digest"]:
            notes.append(f"preserved user-edited asset: {path}")
            continue
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        if record.get("backup"):
            backup = Path(record["backup"])
            if backup.is_dir():
                shutil.copytree(backup, path)
            else:
                shutil.copy2(backup, path)
        notes.append(f"removed managed asset (backup retained if present): {path}")

    manifest_path.unlink()
    for note in notes:
        print(f"- {note}")
    print("\nRemoved. Restart iCode so the changed config files reload.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--remove", action="store_true", help="uninstall everything the installer created")
    parser.add_argument("--agent", default="Code", help="agent profile to wire MCP into (default: Code)")
    parser.add_argument("--config-dir", default=None, help="iCode config dir (default: ~/.chrys or %%APPDATA%%\\chrys)")
    parser.add_argument("--skills-root", default=None, help="shared skills dir (default: ~/.agents/skills)")
    parser.add_argument("--force", action="store_true", help="replace edited configuration/assets, keeping backups")
    parser.add_argument("--dry-run", action="store_true", help="copy nothing into config files; print the manual blocks")
    args = parser.parse_args(argv)

    if args.remove:
        return remove(args)
    return install(args)


if __name__ == "__main__":
    raise SystemExit(main())
