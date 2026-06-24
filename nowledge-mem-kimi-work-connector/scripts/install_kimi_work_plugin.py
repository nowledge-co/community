#!/usr/bin/env python3
"""Install the Nowledge Mem connector into Kimi Work's embedded Kimi runtime."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PLUGIN_ID = "nowledge-mem"
DEFAULT_KIMI_WORK_HOME = (
    Path.home()
    / "Library"
    / "Application Support"
    / "kimi-desktop"
    / "daimon-share"
    / "daimon"
    / "runtime"
    / "kimi-code"
    / "home"
)


def _plugin_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _kimi_work_home() -> Path:
    raw = os.environ.get("KIMI_WORK_HOME", "").strip()
    return Path(raw).expanduser() if raw else DEFAULT_KIMI_WORK_HOME


def _load_json(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return fallback
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Failed to parse {path}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise SystemExit(f"{path} must contain a JSON object")
    return parsed


def _copy_plugin(source_root: Path, managed_root: Path) -> None:
    managed_root.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=f"{PLUGIN_ID}-",
        dir=str(managed_root.parent),
    ) as tmp:
        staging = Path(tmp) / PLUGIN_ID
        shutil.copytree(
            source_root,
            staging,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".git"),
        )
        if managed_root.exists():
            shutil.rmtree(managed_root)
        staging.rename(managed_root)


def _upsert_installed_record(
    *,
    installed_path: Path,
    managed_root: Path,
    source_root: Path,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    data = _load_json(installed_path, {"version": 1, "plugins": []})
    plugins = data.get("plugins")
    if not isinstance(plugins, list):
        raise SystemExit(f"{installed_path} must contain a plugins array")

    existing = next(
        (item for item in plugins if isinstance(item, dict) and item.get("id") == PLUGIN_ID),
        None,
    )
    if isinstance(existing, dict):
        record = {
            **existing,
            "id": PLUGIN_ID,
            "root": str(managed_root),
            "source": existing.get("source") or "local-path",
            "enabled": bool(existing.get("enabled", True)),
            "installedAt": existing.get("installedAt") or now,
            "updatedAt": now,
            "originalSource": str(source_root),
        }
        next_plugins = [
            record if isinstance(item, dict) and item.get("id") == PLUGIN_ID else item
            for item in plugins
        ]
    else:
        record = {
            "id": PLUGIN_ID,
            "root": str(managed_root),
            "source": "local-path",
            "enabled": True,
            "installedAt": now,
            "updatedAt": now,
            "originalSource": str(source_root),
        }
        next_plugins = [*plugins, record]

    installed_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = installed_path.with_suffix(".json.tmp")
    tmp_path.write_text(
        json.dumps({"version": 1, "plugins": next_plugins}, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp_path.replace(installed_path)


def main() -> int:
    source_root = _plugin_root()
    manifest = _load_json(source_root / "kimi.plugin.json", {})
    if manifest.get("name") != PLUGIN_ID:
        print("Invalid connector package: kimi.plugin.json name is not nowledge-mem", file=sys.stderr)
        return 1

    kimi_home = _kimi_work_home()
    if not kimi_home.exists():
        print(
            f"Kimi Work runtime not found: {kimi_home}\n"
            "Open Kimi Work once, or set KIMI_WORK_HOME to its embedded kimi-code home.",
            file=sys.stderr,
        )
        return 1

    managed_root = kimi_home / "plugins" / "managed" / PLUGIN_ID
    installed_path = kimi_home / "plugins" / "installed.json"
    _copy_plugin(source_root, managed_root)
    _upsert_installed_record(
        installed_path=installed_path,
        managed_root=managed_root,
        source_root=source_root,
    )

    print(f"Installed Nowledge Mem for Kimi Work to {managed_root}")
    print("Restart Kimi Work to load the connector.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
