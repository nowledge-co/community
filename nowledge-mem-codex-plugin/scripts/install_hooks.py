#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import stat
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOME = Path.home()
CODEX_DIR = HOME / ".codex"
HOOKS_DIR = CODEX_DIR / "hooks"
GLOBAL_HOOKS_FILE = CODEX_DIR / "hooks.json"
CONFIG_FILE = CODEX_DIR / "config.toml"
SOURCE_HOOK = PLUGIN_ROOT / "hooks" / "nmem-stop-save.py"
INSTALLED_HOOK = HOOKS_DIR / "nowledge-mem-stop-save.py"


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def install_runtime_hook() -> None:
    HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE_HOOK, INSTALLED_HOOK)
    mode = INSTALLED_HOOK.stat().st_mode
    INSTALLED_HOOK.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def merge_hooks_json() -> None:
    if GLOBAL_HOOKS_FILE.exists():
        hooks_doc = load_json(GLOBAL_HOOKS_FILE)
        backup = GLOBAL_HOOKS_FILE.with_suffix(f".json.bak")
        if not backup.exists():
            shutil.copy2(GLOBAL_HOOKS_FILE, backup)
    else:
        hooks_doc = {}

    hooks = hooks_doc.setdefault("hooks", {})
    stop_hooks = hooks.setdefault("Stop", [])

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
    for index, entry in enumerate(stop_hooks):
        for hook in entry.get("hooks", []):
            if hook.get("command") == str(INSTALLED_HOOK):
                stop_hooks[index] = desired
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

    if re.search(r"(?m)^codex_hooks\s*=\s*(true|false)\s*$", text):
        updated = re.sub(r"(?m)^codex_hooks\s*=\s*(true|false)\s*$", "codex_hooks = true", text, count=1)
    elif re.search(r"(?m)^\[features\]\s*$", text):
        updated = re.sub(r"(?m)^\[features\]\s*$", "[features]\ncodex_hooks = true", text, count=1)
    else:
        suffix = "" if text.endswith("\n") or text == "" else "\n"
        updated = f"{text}{suffix}\n[features]\ncodex_hooks = true\n"

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
