#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import re
import shutil
import stat
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOME = Path.home()
CODEX_DIR = HOME / ".codex"
HOOKS_DIR = CODEX_DIR / "hooks"
GLOBAL_HOOKS_FILE = CODEX_DIR / "hooks.json"
CONFIG_FILE = CODEX_DIR / "config.toml"
SOURCE_HOOK = PLUGIN_ROOT / "hooks" / "nmem-stop-save.py"
INSTALLED_HOOK = HOOKS_DIR / "nowledge-mem-stop-save.py"
CODEX_HOOKS_KEY_RE = re.compile(r"^\s*codex_hooks\s*=")


def backup_invalid_json(path: Path, *, reason: str) -> dict:
    backup = path.with_name(f"{path.name}.{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.bak")
    shutil.move(path, backup)
    print(f"warning: moved {reason} to {backup}", file=sys.stderr)
    return {}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return backup_invalid_json(path, reason="malformed JSON")
    if not isinstance(payload, dict):
        return backup_invalid_json(path, reason="non-object JSON")
    return payload


def ensure_nmem_cli_runtime_ready() -> None:
    required_modules = ("nmem_cli", "nmem_cli.session_import")
    missing = [name for name in required_modules if importlib.util.find_spec(name) is None]
    if not missing:
        return
    missing_text = ", ".join(missing)
    raise SystemExit(
        "This installer must be run with a Python interpreter that can import "
        f"{missing_text}. Install nmem-cli into that interpreter, then rerun "
        "scripts/install_hooks.py with the same python3."
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


def rewrite_hook_shebang(path: Path) -> None:
    original = path.read_text(encoding="utf-8")
    lines = original.splitlines()
    desired = f"#!{sys.executable}"
    if lines and lines[0].startswith("#!"):
        lines[0] = desired
    else:
        lines.insert(0, desired)
    updated = "\n".join(lines)
    if original.endswith("\n"):
        updated += "\n"
    path.write_text(updated, encoding="utf-8")

def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def install_runtime_hook() -> None:
    HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE_HOOK, INSTALLED_HOOK)
    rewrite_hook_shebang(INSTALLED_HOOK)
    mode = INSTALLED_HOOK.stat().st_mode
    INSTALLED_HOOK.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def merge_hooks_json() -> None:
    if GLOBAL_HOOKS_FILE.exists():
        backup = GLOBAL_HOOKS_FILE.with_suffix(".json.bak")
        if not backup.exists():
            shutil.copy2(GLOBAL_HOOKS_FILE, backup)
        hooks_doc = load_json(GLOBAL_HOOKS_FILE)
    else:
        hooks_doc = {}

    hooks_doc, stop_hooks = normalize_hooks_doc(hooks_doc)

    desired = {
        "matcher": ".*",
        "hooks": [
            {
                "type": "command",
                "command": str(INSTALLED_HOOK),
            }
        ],
    }

    replaced = False
    for entry in stop_hooks:
        for hook_index, hook in enumerate(entry["hooks"]):
            if not isinstance(hook, dict):
                continue
            if hook.get("command") == str(INSTALLED_HOOK):
                entry["hooks"][hook_index] = dict(desired["hooks"][0])
                replaced = True
                break
        if replaced:
            break

    if not replaced:
        stop_hooks.append(desired)

    save_json(GLOBAL_HOOKS_FILE, hooks_doc)


def ensure_codex_hooks_enabled() -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    text = CONFIG_FILE.read_text(encoding="utf-8") if CONFIG_FILE.exists() else ""
    if text.strip():
        tomllib.loads(text)

    lines = text.splitlines()
    section_header = "[features]"
    target_key = "codex_hooks"
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
            stripped = lines[index].strip()
            if CODEX_HOOKS_KEY_RE.match(stripped):
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
    ensure_nmem_cli_runtime_ready()
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
