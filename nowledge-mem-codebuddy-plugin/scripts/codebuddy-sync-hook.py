#!/usr/bin/env python3
"""CodeBuddy/WorkBuddy lifecycle hook that syncs the current transcript to Mem."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_TIMEOUT_SECONDS = 35
DEFAULT_RETRIES = 2


def _windows_no_window_kwargs() -> dict[str, int]:
    if sys.platform != "win32":
        return {}
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)}


def _buddy_home(source_app: str) -> Path:
    env_name = "WORKBUDDY_CONFIG_DIR" if source_app == "workbuddy" else "CODEBUDDY_CONFIG_DIR"
    default_name = ".workbuddy" if source_app == "workbuddy" else ".codebuddy"
    raw = os.environ.get(env_name)
    if raw and raw.strip():
        return Path(raw).expanduser()
    return Path.home() / default_name


def _path_is_under(path: str, root: Path) -> bool:
    if not path.strip():
        return False
    try:
        candidate = Path(path).expanduser().resolve()
        base = root.expanduser().resolve()
        return candidate == base or base in candidate.parents
    except Exception:
        normalized_path = path.replace("\\", "/").lower()
        normalized_root = str(root.expanduser()).replace("\\", "/").rstrip("/").lower()
        return normalized_path == normalized_root or normalized_path.startswith(
            f"{normalized_root}/"
        )


def _log(source_app: str, message: str) -> None:
    try:
        log_dir = _buddy_home(source_app) / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).isoformat()
        with (log_dir / "nowledge-mem-hook.log").open("a", encoding="utf-8") as handle:
            handle.write(f"{timestamp} [{source_app}] {message}\n")
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
        _log("codebuddy", f"invalid hook payload JSON: {exc}")
        return {}
    return payload if isinstance(payload, dict) else {}


def _source_app_for_payload(payload: dict[str, Any]) -> str:
    override = os.environ.get("NMEM_SOURCE_APP", "").strip().lower()
    if override in {"codebuddy", "workbuddy"}:
        return override
    transcript_path = str(
        payload.get("transcript_path") or payload.get("transcriptPath") or ""
    )
    normalized = transcript_path.replace("\\", "/").lower()
    if "/.workbuddy/" in normalized:
        return "workbuddy"
    if "/.codebuddy/" in normalized:
        return "codebuddy"
    if _path_is_under(transcript_path, _buddy_home("workbuddy")):
        return "workbuddy"
    if _path_is_under(transcript_path, _buddy_home("codebuddy")):
        return "codebuddy"
    return "codebuddy"


def _run_sync(
    source_app: str,
    session_id: str,
    transcript_path: str,
) -> subprocess.CompletedProcess[str]:
    command = [
        "nmem",
        "--json",
        "t",
        "sync",
        "--from",
        source_app,
        "--session-id",
        session_id,
        "--session-dir",
        transcript_path,
        "--all-projects",
        "--apply",
    ]
    return subprocess.run(
        command,
        text=True,
        capture_output=True,
        timeout=_positive_int_env("NMEM_CODEBUDDY_SYNC_TIMEOUT", DEFAULT_TIMEOUT_SECONDS),
        check=False,
        **_windows_no_window_kwargs(),
    )


def main() -> int:
    payload = _read_payload()
    source_app = _source_app_for_payload(payload)
    session_id = str(payload.get("session_id") or payload.get("sessionId") or "").strip()
    transcript_path = str(
        payload.get("transcript_path") or payload.get("transcriptPath") or ""
    ).strip()
    event = str(payload.get("hook_event_name") or "unknown").strip() or "unknown"
    if not session_id:
        _log(source_app, f"skip {event}: missing session_id")
        return 0
    if not transcript_path:
        _log(source_app, f"skip {event} {session_id}: missing transcript_path")
        return 0
    if not Path(transcript_path).expanduser().exists():
        _log(source_app, f"skip {event} {session_id}: transcript not found at {transcript_path}")
        return 0

    attempts = _positive_int_env("NMEM_CODEBUDDY_SYNC_RETRIES", DEFAULT_RETRIES)
    for attempt in range(1, attempts + 1):
        try:
            result = _run_sync(source_app, session_id, transcript_path)
        except FileNotFoundError:
            _log(source_app, f"skip {event} {session_id}: nmem not found on PATH")
            return 0
        except subprocess.TimeoutExpired:
            _log(source_app, f"timeout {event} {session_id}: nmem sync exceeded timeout")
            return 0
        except Exception as exc:
            _log(source_app, f"error {event} {session_id}: {exc}")
            return 0

        if result.returncode == 0:
            _log(source_app, f"synced {event} {session_id} from {transcript_path}")
            return 0

        stderr = (result.stderr or "").strip().replace("\n", " ")[:600]
        stdout = (result.stdout or "").strip().replace("\n", " ")[:600]
        _log(
            source_app,
            f"sync failed {event} {session_id} attempt={attempt}/{attempts} "
            f"exit={result.returncode} stderr={stderr!r} stdout={stdout!r}"
        )
        if attempt < attempts:
            time.sleep(0.7)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
