#!/usr/bin/env python3
"""Read Nowledge Mem Working Memory for Proma SessionStart hook.

Calls `nmem --json wm read` via subprocess and outputs the result as JSON
for the Proma Agent SDK to inject as session context.

Falls back gracefully if nmem is not installed or the server is unreachable.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import Any

PROMA_HOME = Path(os.environ.get("PROMA_HOME", Path.home() / ".proma"))
LOG_DIR = PROMA_HOME / "log"
LOG_FILE = LOG_DIR / "nmem-hook.log"


def log(msg: str) -> None:
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(f"[{ts}] {msg}\n")
    except Exception:
        pass


def _find_nmem() -> str | None:
    """Locate the nmem CLI executable."""
    found = shutil.which("nmem") or shutil.which("nmem.cmd")
    if found:
        return found
    # Check common install paths on Windows
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Nowledge Mem" / "cli" / "nmem.cmd",
        Path.home() / ".pixi" / "envs" / "python" / "Scripts" / "nmem.exe",
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return None


def read_working_memory() -> dict[str, Any] | None:
    nmem = _find_nmem()
    if not nmem:
        log("nmem CLI not found")
        return None

    cmd = [nmem, "--json", "wm", "read"]
    # Wrap .cmd files through cmd.exe
    if nmem.lower().endswith(".cmd"):
        cmd = ["cmd.exe", "/s", "/c", subprocess.list2cmdline(cmd)]

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=15,
            check=False,
        )
        if proc.returncode != 0:
            log(f"nmem wm read exit={proc.returncode} stderr={proc.stderr.strip()[:200]}")
            return None
        raw = proc.stdout.strip()
        if not raw:
            return None
        return json.loads(raw)
    except subprocess.TimeoutExpired:
        log("nmem wm read timed out")
        return None
    except Exception as exc:
        log(f"nmem wm read error: {exc}")
        return None


def main() -> int:
    log("read-working-memory start")

    wm = read_working_memory()
    if wm is None:
        log("read-working-memory: no data")
        print(json.dumps({"working_memory": None, "status": "empty"}))
        return 0

    log(f"read-working-memory: got data keys={list(wm.keys())}")
    print(json.dumps(wm, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
