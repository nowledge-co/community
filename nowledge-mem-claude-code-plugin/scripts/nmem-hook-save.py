#!/usr/bin/env python3
"""Best-effort Claude Code transcript capture for Nowledge Mem hooks."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


TIMEOUT_SECONDS = 30


def _read_hook_input() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _nmem_command() -> str | None:
    return shutil.which("nmem") or shutil.which("nmem.cmd")


def _build_command(nmem: str, payload: dict[str, Any]) -> list[str]:
    command = [nmem, "t", "save", "--from", "claude-code", "--truncate"]

    session_id = payload.get("session_id")
    if isinstance(session_id, str) and session_id.strip():
        command.extend(["--session-id", session_id.strip()])

    cwd = payload.get("cwd")
    if isinstance(cwd, str) and cwd.strip():
        command.extend(["--project", str(Path(cwd).expanduser())])

    return command


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--event",
        default="hook",
        choices=["pre-compact", "stop", "hook"],
        help="Hook event label used only for diagnostics.",
    )
    args = parser.parse_args()

    nmem = _nmem_command()
    if not nmem:
        print("nowledge-mem: nmem not found; skipped hook capture", file=sys.stderr)
        return 0

    payload = _read_hook_input()
    command = _build_command(nmem, payload)

    try:
        proc = subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        print(
            f"nowledge-mem: {args.event} capture timed out after {TIMEOUT_SECONDS}s",
            file=sys.stderr,
        )
        return 0
    except Exception as exc:
        print(f"nowledge-mem: {args.event} capture failed: {exc}", file=sys.stderr)
        return 0

    if proc.returncode != 0:
        message = (proc.stderr or "").strip()
        if message:
            print(f"nowledge-mem: {args.event} capture skipped: {message}", file=sys.stderr)
        return 0

    if args.event == "pre-compact":
        print(
            "Nowledge Mem saved the current Claude Code thread before compaction."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
