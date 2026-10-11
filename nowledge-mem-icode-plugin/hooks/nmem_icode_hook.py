#!/usr/bin/env python3
"""iCode user_prompt_submit hook for Nowledge Mem.

Behavior (fail-open: any error exits 0 without touching the result file):

- On the first prompt of a session (tracked per session id under
  ~/.nowledge-mem/icode-hook-state/), run ``nmem context`` (falling back to
  ``nmem working-memory``) and return it as the turn's ``system_reminder``.
- On later prompts, return a short recall/save reminder unless
  NMEM_ICODE_RECALL is ``first`` or ``off``.

Environment knobs:
- NMEM_ICODE_CONTEXT=off     disable context injection entirely
- NMEM_ICODE_RECALL=every|first|off   reminder frequency (default: every)
- NMEM_ICODE_TIMEOUT_SECONDS nmem call budget per attempt (default: 6)

iCode contract: the event payload is a JSON file at CHRYS_HOOK_PAYLOAD_FILE;
blocking hooks write a JSON object to CHRYS_HOOK_RESULT, and only a
``system_reminder`` string is honored for user_prompt_submit.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

RECALL_REMINDER = (
    "[Nowledge Mem] If this continues earlier work, a review, or a prior "
    "decision, search first (memory_search MCP tool, or nmem --json m search "
    '"query"). Save durable decisions, procedures, and learnings proactively '
    "(memory_add, or nmem m add \"...\"). Do not wait to be asked."
)

CONTEXT_PREFIX = (
    "[Nowledge Mem] Session context loaded below. Use it to resume work; "
    "search memories when past knowledge helps and save durable outcomes "
    "proactively."
)


def _state_dir() -> Path:
    if sys.platform == "win32":
        base = Path.home() / "AppData" / "Roaming" / ".nowledge-mem"
    else:
        base = Path.home() / ".nowledge-mem"
    path = base / "icode-hook-state"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _nmem_argv() -> list[str] | None:
    if shutil.which("nmem"):
        return ["nmem"]
    if shutil.which("uvx"):
        return ["uvx", "--from", "nmem-cli", "nmem"]
    return None


def _run_nmem(prefix: list[str], args: list[str], timeout: float) -> str | None:
    try:
        proc = subprocess.run(
            [*prefix, *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            stdin=subprocess.DEVNULL,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    text = (proc.stdout or "").strip()
    return text or None


def _load_context(timeout: float) -> str | None:
    prefix = _nmem_argv()
    if prefix is None:
        return None
    return _run_nmem(prefix, ["context"], timeout) or _run_nmem(
        prefix, ["working-memory"], timeout
    )


def _already_injected(session_key: str) -> bool:
    marker = _state_dir() / f"{session_key}.json"
    return marker.exists()


def _mark_injected(session_key: str) -> None:
    marker = _state_dir() / f"{session_key}.json"
    try:
        marker.write_text(json.dumps({"context": True}) + "\n", encoding="utf-8")
    except OSError:
        pass


def _safe_session_key(payload: dict) -> str:
    raw = str(payload.get("session_id") or "default")
    keep = [c if c.isalnum() or c in "-_" else "_" for c in raw]
    key = "".join(keep)[:64]
    return key or "default"


def main() -> int:
    if os.environ.get("NMEM_ICODE_CONTEXT", "").strip().lower() == "off":
        return 0

    payload_file = os.environ.get("CHRYS_HOOK_PAYLOAD_FILE", "")
    if not payload_file:
        return 0
    try:
        payload = json.loads(Path(payload_file).read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            return 0
    except (OSError, ValueError):
        return 0

    if payload.get("event") != "user_prompt_submit":
        return 0

    recall_mode = os.environ.get("NMEM_ICODE_RECALL", "every").strip().lower()
    timeout = 6.0
    try:
        timeout = max(1.0, float(os.environ.get("NMEM_ICODE_TIMEOUT_SECONDS", "6")))
    except ValueError:
        pass

    session_key = _safe_session_key(payload)
    reminder: str | None = None

    if not _already_injected(session_key):
        context = _load_context(timeout)
        if context:
            reminder = f"{CONTEXT_PREFIX}\n\n{context}"
            _mark_injected(session_key)
        elif payload.get("injected") is False:
            reminder = RECALL_REMINDER
            _mark_injected(session_key)
    elif recall_mode == "every":
        reminder = RECALL_REMINDER

    if not reminder:
        return 0

    result_file = os.environ.get("CHRYS_HOOK_RESULT", "")
    if not result_file:
        return 0
    try:
        Path(result_file).write_text(
            json.dumps({"system_reminder": reminder}) + "\n", encoding="utf-8"
        )
    except OSError:
        return 0
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:  # fail-open: never break the host prompt flow
        raise SystemExit(0)
