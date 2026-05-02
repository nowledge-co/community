#!/usr/bin/env python3
"""Install the Nowledge Mem Codex Stop hook into the current CODEX_HOME."""

from __future__ import annotations

import json
import os
import re
import shutil
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
CODEX_DIR = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")).expanduser()
HOOKS_DIR = CODEX_DIR / "hooks"
GLOBAL_HOOKS_FILE = CODEX_DIR / "hooks.json"
CONFIG_FILE = CODEX_DIR / "config.toml"
SOURCE_HOOK = PLUGIN_ROOT / "hooks" / "nmem-stop-save.py"
INSTALLED_HOOK = HOOKS_DIR / "nowledge-mem-stop-save.py"
CODEX_HOOKS_KEY_RE = re.compile(r"^\s*codex_hooks\s*=")
NOWLEDGE_HOOK_MARKERS = ("nowledge-mem-stop-save.py", "nmem-stop-save.py")


def _backup_path(path: Path) -> Path:
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return path.with_name(f"{path.name}.{suffix}.bak")


def backup_invalid_json(path: Path, *, reason: str) -> dict:
    backup = _backup_path(path)
    shutil.move(path, backup)
    print(f"warning: moved {reason} to {backup}", file=sys.stderr)
    return {}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return backup_invalid_json(path, reason="malformed hooks JSON")
    if not isinstance(payload, dict):
        return backup_invalid_json(path, reason="non-object hooks JSON")
    return payload


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def normalize_hooks_doc(hooks_doc: dict) -> tuple[dict, list[dict]]:
    hooks = hooks_doc.get("hooks")
    if not isinstance(hooks, dict):
        hooks = {}
        hooks_doc["hooks"] = hooks

    stop_hooks = hooks.get("Stop")
    if not isinstance(stop_hooks, list):
        stop_hooks = []

    normalized_stop_hooks: list[dict] = []
    for entry in stop_hooks:
        if not isinstance(entry, dict):
            continue
        normalized_entry = dict(entry)
        if not isinstance(normalized_entry.get("hooks"), list):
            normalized_entry["hooks"] = []
        normalized_stop_hooks.append(normalized_entry)

    hooks["Stop"] = normalized_stop_hooks
    return hooks_doc, normalized_stop_hooks


def install_runtime_hook() -> None:
    if not SOURCE_HOOK.exists():
        raise SystemExit(f"missing hook runtime: {SOURCE_HOOK}")
    HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE_HOOK, INSTALLED_HOOK)
    mode = INSTALLED_HOOK.stat().st_mode
    INSTALLED_HOOK.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _quote_for_hook_command(path: Path) -> str:
    return json.dumps(str(path))


def _hook_command() -> str:
    return f"{_quote_for_hook_command(Path(sys.executable))} {_quote_for_hook_command(INSTALLED_HOOK)} --event stop"


def _is_nowledge_hook(hook: object) -> bool:
    if not isinstance(hook, dict):
        return False
    command = hook.get("command")
    return isinstance(command, str) and any(marker in command for marker in NOWLEDGE_HOOK_MARKERS)


def merge_hooks_json() -> None:
    hooks_doc = load_json(GLOBAL_HOOKS_FILE)
    if GLOBAL_HOOKS_FILE.exists():
        backup = GLOBAL_HOOKS_FILE.with_suffix(".json.bak")
        if not backup.exists():
            shutil.copy2(GLOBAL_HOOKS_FILE, backup)

    hooks_doc, stop_hooks = normalize_hooks_doc(hooks_doc)
    cleaned: list[dict] = []
    for entry in stop_hooks:
        hooks = [hook for hook in entry["hooks"] if not _is_nowledge_hook(hook)]
        if hooks:
            next_entry = dict(entry)
            next_entry["hooks"] = hooks
            cleaned.append(next_entry)

    cleaned.append(
        {
            "matcher": ".*",
            "hooks": [
                {
                    "type": "command",
                    "command": _hook_command(),
                    "timeout": 40,
                    "statusMessage": "Saving Codex thread to Nowledge Mem...",
                }
            ],
        }
    )
    hooks_doc["hooks"]["Stop"] = cleaned
    save_json(GLOBAL_HOOKS_FILE, hooks_doc)


def _validate_toml_if_possible(text: str) -> None:
    if not text.strip():
        return
    try:
        import tomllib

        tomllib.loads(text)
    except ModuleNotFoundError:
        return
    except Exception as error:
        raise SystemExit(
            f"error: refusing to modify invalid Codex config.toml: {error}"
        ) from error


def ensure_codex_hooks_enabled() -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    text = CONFIG_FILE.read_text(encoding="utf-8") if CONFIG_FILE.exists() else ""
    _validate_toml_if_possible(text)

    lines = text.splitlines()
    section_header = "[features]"
    features_start = None
    features_end = len(lines)

    for index, line in enumerate(lines):
        if line.strip() == section_header:
            features_start = index
            break

    if features_start is None:
        if lines and lines[-1] != "":
            lines.append("")
        lines.extend([section_header, "codex_hooks = true"])
    else:
        for index in range(features_start + 1, len(lines)):
            stripped = lines[index].strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                features_end = index
                break

        replaced = False
        for index in range(features_start + 1, features_end):
            if CODEX_HOOKS_KEY_RE.match(lines[index].strip()):
                lines[index] = "codex_hooks = true"
                replaced = True
                break

        if not replaced:
            lines.insert(features_end, "codex_hooks = true")

    updated = "\n".join(lines)
    if updated and not updated.endswith("\n"):
        updated += "\n"
    CONFIG_FILE.write_text(updated, encoding="utf-8")


def main() -> int:
    install_runtime_hook()
    merge_hooks_json()
    ensure_codex_hooks_enabled()

    print("Installed Nowledge Mem Codex Stop hook")
    print(f"- runtime hook: {INSTALLED_HOOK}")
    print(f"- hooks config: {GLOBAL_HOOKS_FILE}")
    print(f"- feature flag ensured in: {CONFIG_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
