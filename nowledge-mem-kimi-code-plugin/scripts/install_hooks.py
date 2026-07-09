#!/usr/bin/env python3
"""Install Nowledge Mem Kimi Code lifecycle hooks.

Modern Kimi Code loads these hooks directly from kimi.plugin.json. This script
is kept as a host-level fallback for older Kimi Code builds or environments
where users deliberately want hooks in ~/.kimi-code/config.toml.
"""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
from datetime import datetime, timezone
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
SOURCE_HOOK = PLUGIN_ROOT / "scripts" / "kimi-sync-hook.py"
HOOK_MARKER = "nowledge-mem-sync-hook.py"
MANAGED_BEGIN = "# BEGIN Nowledge Mem Kimi Code hooks (managed by nowledge-mem-kimi-code-plugin)"
MANAGED_END = "# END Nowledge Mem Kimi Code hooks"


def _kimi_home() -> Path:
    raw = os.environ.get("KIMI_CODE_HOME")
    if raw and raw.strip():
        return Path(raw).expanduser()
    return Path.home() / ".kimi-code"


KIMI_HOME = _kimi_home()
CONFIG_FILE = KIMI_HOME / "config.toml"
HOOKS_DIR = KIMI_HOME / "hooks"
INSTALLED_HOOK = HOOKS_DIR / HOOK_MARKER


def _backup_path(path: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return path.with_name(f"{path.name}.{stamp}.bak")


def _validate_toml_if_possible(text: str) -> None:
    if not text.strip():
        return
    try:
        import tomllib

        tomllib.loads(text)
    except ModuleNotFoundError:
        return
    except Exception as exc:
        raise SystemExit(f"error: refusing to modify invalid Kimi config.toml: {exc}") from exc


def _command_string() -> str:
    override = os.environ.get("NMEM_KIMI_HOOK_PYTHON")
    if override and override.strip():
        args = [override.strip(), str(INSTALLED_HOOK)]
    elif os.name == "nt":
        args = ["py", "-3", str(INSTALLED_HOOK)]
    else:
        args = ["python3", str(INSTALLED_HOOK)]
    if os.name == "nt":
        return subprocess.list2cmdline(args)
    import shlex

    return shlex.join(args)


def _toml_string(value: str) -> str:
    import json

    return json.dumps(value, ensure_ascii=False)


def _managed_block() -> str:
    command = _toml_string(_command_string())
    # Stop gives near-live capture after each completed turn. SessionEnd,
    # PreCompact, Interrupt, and SubagentStop cover clean exit, compaction,
    # interrupted turns, and Kimi's delegated agent work.
    parts = [MANAGED_BEGIN]
    for event in ("Stop", "SessionEnd", "PreCompact", "SubagentStop", "Interrupt"):
        parts.extend(
            [
                "[[hooks]]",
                f'event = "{event}"',
                f"command = {command}",
                "timeout = 40",
                "",
            ]
        )
    parts.append(MANAGED_END)
    return "\n".join(parts) + "\n"


def _remove_managed_block(text: str) -> str:
    if MANAGED_BEGIN not in text:
        return text
    before, rest = text.split(MANAGED_BEGIN, 1)
    if MANAGED_END not in rest:
        raise SystemExit(
            "error: refusing to modify Kimi config.toml because the Nowledge Mem "
            "managed hook block is missing its END marker. Please inspect the "
            "existing block before rerunning this installer."
        )
    _, after = rest.split(MANAGED_END, 1)
    return (before.rstrip() + "\n\n" + after.lstrip()).lstrip("\n")


def _install_hook_script() -> None:
    if not SOURCE_HOOK.exists():
        raise SystemExit(f"error: missing hook runtime: {SOURCE_HOOK}")
    HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE_HOOK, INSTALLED_HOOK)
    mode = INSTALLED_HOOK.stat().st_mode
    INSTALLED_HOOK.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _install_config() -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    text = CONFIG_FILE.read_text(encoding="utf-8") if CONFIG_FILE.exists() else ""
    _validate_toml_if_possible(text)
    updated = _remove_managed_block(text).rstrip()
    if updated:
        updated += "\n\n"
    updated += _managed_block()
    _validate_toml_if_possible(updated)

    if CONFIG_FILE.exists():
        backup = _backup_path(CONFIG_FILE)
        shutil.copy2(CONFIG_FILE, backup)
        print(f"Backed up {CONFIG_FILE} -> {backup}")
    CONFIG_FILE.write_text(updated, encoding="utf-8")


def main() -> int:
    _install_hook_script()
    _install_config()
    print(f"Installed Nowledge Mem Kimi Code hook: {INSTALLED_HOOK}")
    print(f"Updated Kimi Code config: {CONFIG_FILE}")
    print("Restart Kimi Code or start a new session for hooks to take effect.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
