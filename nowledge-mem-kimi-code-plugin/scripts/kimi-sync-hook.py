#!/usr/bin/env python3
"""Kimi Code lifecycle hook that syncs the current session to Nowledge Mem.

Kimi passes hook payload JSON on stdin. This script is deliberately fail-open:
errors are logged locally and never block the user's Kimi Code turn.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SOURCE_APP = "kimi-code"
DEFAULT_TIMEOUT_SECONDS = 35
DEFAULT_RETRIES = 2


def _windows_no_window_kwargs() -> dict[str, int]:
    if sys.platform != "win32":
        return {}
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)}


def _kimi_home() -> Path:
    raw = os.environ.get("KIMI_CODE_HOME")
    if raw and raw.strip():
        return Path(raw).expanduser()
    return Path.home() / ".kimi-code"


def _log(message: str) -> None:
    log_dir = _kimi_home() / "logs"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).isoformat()
        with (log_dir / "nowledge-mem-hook.log").open("a", encoding="utf-8") as handle:
            handle.write(f"{timestamp} {message}\n")
    except Exception:
        return


def _positive_int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        _log(f"invalid hook payload JSON: {exc}")
        return {}
    return payload if isinstance(payload, dict) else {}


def _run_sync(session_id: str) -> subprocess.CompletedProcess[str]:
    command = [
        "nmem",
        "--json",
        "t",
        "sync",
        "--from",
        SOURCE_APP,
        "--session-id",
        session_id,
        "--apply",
    ]
    return subprocess.run(
        command,
        text=True,
        capture_output=True,
        timeout=_positive_int_env("NMEM_KIMI_SYNC_TIMEOUT", DEFAULT_TIMEOUT_SECONDS),
        check=False,
        **_windows_no_window_kwargs(),
    )


def main() -> int:
    payload = _read_payload()
    session_id = str(payload.get("session_id") or "").strip()
    event = str(payload.get("hook_event_name") or "unknown").strip() or "unknown"
    if not session_id:
        _log(f"skip {event}: missing session_id")
        return 0

    attempts = _positive_int_env("NMEM_KIMI_SYNC_RETRIES", DEFAULT_RETRIES)
    for attempt in range(1, attempts + 1):
        try:
            result = _run_sync(session_id)
        except FileNotFoundError:
            _log(f"skip {event} {session_id}: nmem not found on PATH")
            return 0
        except subprocess.TimeoutExpired:
            _log(f"timeout {event} {session_id}: nmem sync exceeded timeout")
            return 0
        except Exception as exc:
            _log(f"error {event} {session_id}: {exc}")
            return 0

        if result.returncode == 0:
            _log(f"synced {event} {session_id}")
            return 0

        stderr = (result.stderr or "").strip().replace("\n", " ")[:600]
        stdout = (result.stdout or "").strip().replace("\n", " ")[:600]
        _log(
            f"sync failed {event} {session_id} attempt={attempt}/{attempts} "
            f"exit={result.returncode} stderr={stderr!r} stdout={stdout!r}"
        )
        if attempt < attempts:
            time.sleep(0.7)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
