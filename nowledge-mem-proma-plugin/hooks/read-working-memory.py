#!/usr/bin/env python3
"""Read Nowledge Mem startup context for Proma SessionStart hook.

Calls `nmem --json context --source-app proma` when available, then falls
back to `nmem --json wm read`. The result is emitted as JSON for the Proma
Agent SDK to inject as session context.

Falls back gracefully if nmem is not installed or the server is unreachable.
"""

from __future__ import annotations

import json
import os
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


def _nmem_command_prefix() -> list[str] | None:
    """Return the command prefix for invoking nmem."""
    found = shutil.which("nmem") or shutil.which("nmem.cmd")
    if found:
        return [found]
    # Check common install paths on Windows
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Nowledge Mem" / "cli" / "nmem.cmd",
        Path.home() / ".pixi" / "envs" / "python" / "Scripts" / "nmem.exe",
    ]
    for p in candidates:
        if p.exists():
            return [str(p)]
    # uvx fallback (per plugin development guide)
    uvx = shutil.which("uvx")
    if uvx:
        return [uvx, "--from", "nmem-cli", "nmem"]
    return None


def _run_nmem_json(args: list[str], label: str) -> dict[str, Any] | None:
    prefix = _nmem_command_prefix()
    if not prefix:
        log("nmem CLI not found")
        return None

    cmd = [*prefix, "--json", *args]
    # Wrap Windows batch launchers through cmd.exe; keep argv split so quoted
    # paths and following arguments are not flattened into one brittle string.
    if Path(prefix[0]).name.lower().endswith(".cmd"):
        cmd = ["cmd.exe", "/d", "/c", "call", *cmd]

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
            log(f"{label} exit={proc.returncode} stderr={proc.stderr.strip()[:200]}")
            return None
        raw = proc.stdout.strip()
        if not raw:
            return None
        return json.loads(raw)
    except subprocess.TimeoutExpired:
        log(f"{label} timed out")
        return None
    except Exception as exc:
        log(f"{label} error: {exc}")
        return None


def _env_value(name: str) -> str:
    return os.environ.get(name, "").strip()


def _context_args() -> list[str]:
    args = ["context", "--source-app", "proma"]
    agent_id = _env_value("NMEM_AGENT_ID")
    host_agent_id = _env_value("NMEM_HOST_AGENT_ID")
    space = _env_value("NMEM_SPACE") or _env_value("NMEM_SPACE_ID")
    if agent_id:
        args.extend(["--agent-id", agent_id])
    if host_agent_id:
        args.extend(["--host-agent-id", host_agent_id])
    if space:
        args.extend(["--space", space])
    return args


def _working_memory_args() -> list[str]:
    args = ["wm", "read"]
    space = _env_value("NMEM_SPACE") or _env_value("NMEM_SPACE_ID")
    if space:
        args.extend(["--space", space])
    return args


def main() -> int:
    log("read-startup-context start")

    context = _run_nmem_json(_context_args(), "nmem context")
    if context is None:
        context = _run_nmem_json(_working_memory_args(), "nmem wm read")

    if context is None:
        log("read-startup-context: no data")
        print(json.dumps({"context": None, "working_memory": None, "status": "empty"}))
        return 0

    log(f"read-startup-context: got data keys={list(context.keys())}")
    print(json.dumps(context, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
