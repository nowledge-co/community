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

PyYAML is optional. Without it the installer still copies the hook script and
skills and prints the exact YAML blocks to paste manually.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

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
    if not api_url:
        api_url = str(cfg.get("apiUrl", "")).strip().rstrip("/")
    if api_key is None:
        api_key = str(cfg.get("apiKey", "")).strip() or None
    if not api_url:
        api_url = "http://127.0.0.1:14242"
    return api_url, api_key


def _backup(path: Path) -> Path | None:
    if not path.exists():
        return None
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    target = path.with_name(f"{path.name}.{stamp}.nmem-bak")
    shutil.copy2(path, target)
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


def _copy_hook_script(hooks_dir: Path) -> list[str]:
    src = PLUGIN_ROOT / "hooks" / HOOK_SCRIPT_NAME
    dst = hooks_dir / "scripts" / HOOK_SCRIPT_NAME
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    dst.chmod(dst.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP)
    return [f"installed hook script: {dst}"]


def _copy_skills(skills_root: Path, force: bool) -> list[str]:
    notes: list[str] = []
    skills_root.mkdir(parents=True, exist_ok=True)
    for name in SKILL_NAMES:
        src = PLUGIN_ROOT / "skills" / name
        dst = skills_root / name
        if dst.exists():
            if force:
                shutil.rmtree(dst)
                shutil.copytree(src, dst)
                notes.append(f"skill {name}: updated (--force)")
            else:
                notes.append(f"skill {name}: kept existing (use --force to overwrite)")
            continue
        shutil.copytree(src, dst)
        notes.append(f"skill {name}: installed")
    return notes


def _write_manifest(config_dir: Path, created: dict) -> None:
    manifest = {
        "plugin": "nowledge-mem-icode-plugin",
        "version": PLUGIN_VERSION,
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "created": created,
    }
    (config_dir / MANIFEST_NAME).write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def _print_manual_blocks(api_url: str, agent: str) -> None:
    yaml = _yaml()
    entry = _mcp_entry(api_url, "<your-api-key>")
    hook = _hook_entry()
    print("\nManual configuration blocks:\n")
    print(f"1) {agent} profile (tools.mcp):")
    if yaml:
        print(yaml.safe_dump([entry], sort_keys=False).strip())
    else:
        print(json.dumps(entry, indent=2))
    print("\n2) hooks.yaml (hooks list):")
    if yaml:
        print(yaml.safe_dump([hook], sort_keys=False).strip())
    else:
        print(json.dumps(hook, indent=2))


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
    if not profile_path.exists():
        print(
            f"warning: {profile_path} does not exist yet; iCode will only load it "
            "after the profile is created (e.g. save that agent once in the TUI), "
            "or create it from the builtin profile first"
        )

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
    notes += _copy_hook_script(hooks_dir)
    notes += _copy_skills(skills_root, args.force)
    created["skills"] = [n for n in SKILL_NAMES if (skills_root / n).exists()]

    if args.dry_run:
        print("dry run: no config files modified")
        for note in notes:
            print(f"  - {note}")
        _print_manual_blocks(api_url, agent)
        return 0

    notes += _merge_agent_profile(profile_path, agent, _mcp_entry(api_url, api_key))
    notes += _merge_hooks_file(hooks_dir / "hooks.yaml", _hook_entry())
    _write_manifest(config_dir, created)

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

    yaml = _yaml()
    notes: list[str] = []

    profile_path = Path(created.get("agent_profile", ""))
    if yaml and profile_path.exists():
        data = yaml.safe_load(profile_path.read_text(encoding="utf-8")) or {}
        tools = data.get("tools") or {}
        servers = tools.get("mcp")
        if isinstance(servers, list):
            kept = [
                s
                for s in servers
                if not (isinstance(s, dict) and s.get("name") == SERVER_NAME)
            ]
            if len(kept) != len(servers):
                tools["mcp"] = kept
                _backup(profile_path)
                profile_path.write_text(
                    yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
                    encoding="utf-8",
                )
                notes.append(f"removed {SERVER_NAME} from {profile_path.name}")

    hooks_file = Path(created.get("hooks_file", ""))
    if yaml and hooks_file.exists():
        data = yaml.safe_load(hooks_file.read_text(encoding="utf-8")) or {}
        hooks = data.get("hooks")
        if isinstance(hooks, list):
            kept = [h for h in hooks if not (isinstance(h, dict) and h.get("id") == HOOK_ID)]
            if len(kept) != len(hooks):
                data["hooks"] = kept
                _backup(hooks_file)
                hooks_file.write_text(
                    yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
                    encoding="utf-8",
                )
                notes.append(f"removed {HOOK_ID} from {hooks_file.name}")

    hook_script = Path(created.get("hook_script", ""))
    if hook_script.exists():
        hook_script.unlink()
        notes.append(f"removed {hook_script}")

    skills_root = Path(created.get("skills_root", ""))
    for name in created.get("skills", []):
        skill_dir = skills_root / str(name)
        if skill_dir.exists():
            shutil.rmtree(skill_dir)
            notes.append(f"removed skill {name}")

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
    parser.add_argument("--force", action="store_true", help="overwrite existing skill directories")
    parser.add_argument("--dry-run", action="store_true", help="copy nothing into config files; print the manual blocks")
    args = parser.parse_args(argv)

    if args.remove:
        return remove(args)
    return install(args)


if __name__ == "__main__":
    raise SystemExit(main())
