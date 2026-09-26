#!/usr/bin/env python3
"""Fail-open DimAgent lifecycle hook that requests durable nmem capture."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from nmem_runtime import build_nmem_command, find_nmem_command, windows_no_window_kwargs

_LOG_LIMIT_BYTES = 64 * 1024
_CAPTURE_TIMEOUT_SECONDS = 8


def _log_path() -> Path:
    configured = os.environ.get("DIMCODE_HOME", "").strip()
    root = Path(configured).expanduser() if configured else Path.home() / ".dim"
    return root / "logs" / "nowledge-mem-capture.log"


def _log(message: str) -> None:
    try:
        path = _log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        encoded = f"{message}\n".encode("utf-8", errors="replace")
        with path.open("ab") as handle:
            handle.write(encoded)
        if path.stat().st_size > _LOG_LIMIT_BYTES:
            with path.open("rb") as handle:
                handle.seek(-_LOG_LIMIT_BYTES, os.SEEK_END)
                tail = handle.read()
            path.write_bytes(tail)
    except OSError:
        pass


def _read_payload(stream: Any = sys.stdin) -> dict[str, Any]:
    try:
        payload = json.load(stream)
    except (OSError, ValueError, TypeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _capture_id(payload: dict[str, Any]) -> str | None:
    key = "agent_id" if payload.get("hook_event_name") == "SubagentStop" else "session_id"
    value = payload.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


def _acknowledged(stdout: str) -> bool:
    try:
        payload = json.loads(stdout)
    except (TypeError, ValueError):
        return False
    return isinstance(payload, dict) and payload.get("status") == "enqueued"


def _capture(payload: dict[str, Any]) -> None:
    session_id = _capture_id(payload)
    if not session_id:
        _log("capture skipped: missing required session identifier")
        return

    nmem = find_nmem_command()
    if not nmem:
        _log("capture skipped: nmem command was not found")
        return

    command = build_nmem_command(
        nmem,
        "--json",
        "t",
        "capture",
        "--from",
        "dimagent",
        "--session-id",
        session_id,
    )
    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=_CAPTURE_TIMEOUT_SECONDS,
            **windows_no_window_kwargs(),
        )
    except (OSError, subprocess.TimeoutExpired):
        _log("capture skipped: nmem invocation failed")
        return

    if completed.returncode != 0 or not _acknowledged(completed.stdout):
        _log("capture skipped: nmem did not acknowledge durable enqueue")


def main() -> int:
    _capture(_read_payload())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
