#!/usr/bin/env python3
"""Inject cross-tool Nowledge context and routing into Codex lifecycle hooks."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from nmem_runtime import build_nmem_command as _build_nmem_command
from nmem_runtime import find_nmem_command as _find_nmem_command
from nmem_runtime import windows_no_window_kwargs as _windows_no_window_kwargs


CONTEXT_TOTAL_TIMEOUT_SECONDS = 10.0
CONTEXT_ATTEMPT_TIMEOUT_SECONDS = 7.0
ROUTING_GUIDANCE = """## Nowledge Mem routing

Codex local Memory and Nowledge Mem are separate. Treat Codex local Memory as a convenient local hint; use Nowledge Mem as the source for cross-tool context, current Working Memory, exact prior threads, and sourced decisions. For continuation, review, regression, release, connector, prior-decision, or exact-history work, run one targeted Nowledge memory or thread search before concluding. Do not skip that search only because Codex local Memory contains a related summary. Prefer Nowledge MCP tools when available and distill durable new decisions back to Nowledge Mem.
"""
PROMPT_ROUTING_GUIDANCE = """Codex local Memory is only a local hint. For continuation, review, regression, release, connector, prior-decision, cross-tool, or exact-history work, search Nowledge memory or threads once before concluding; do not let a Codex Memory summary replace that search."""


def _nmem_command() -> str | None:
    return _find_nmem_command()


def _read_hook_input() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _run_nmem_json(
    nmem: str,
    args: list[str],
    *,
    timeout_seconds: float,
) -> dict[str, Any] | None:
    try:
        proc = subprocess.run(
            _build_nmem_command(nmem, "--json", *args),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=max(0.1, timeout_seconds),
            check=False,
            **_windows_no_window_kwargs(),
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _context_args() -> list[str]:
    args = ["context", "--source-app", "codex"]
    for env_name, flag in (
        ("NMEM_AGENT_ID", "--agent-id"),
        ("NMEM_HOST_AGENT_ID", "--host-agent-id"),
        ("NMEM_SPACE", "--space"),
    ):
        value = os.environ.get(env_name, "").strip()
        if value:
            args.extend([flag, value])
    return args


def _working_memory_args() -> list[str]:
    args = ["wm", "read"]
    space = os.environ.get("NMEM_SPACE", "").strip()
    if space:
        args.extend(["--space", space])
    return args


def _rendered_context(payload: dict[str, Any] | None) -> str:
    if not payload:
        return ""
    for key in ("rendered_markdown", "content"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _load_startup_context() -> str:
    nmem = _nmem_command()
    if nmem:
        deadline = time.monotonic() + CONTEXT_TOTAL_TIMEOUT_SECONDS
        for args in (_context_args(), _working_memory_args()):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            rendered = _rendered_context(
                _run_nmem_json(
                    nmem,
                    args,
                    timeout_seconds=min(CONTEXT_ATTEMPT_TIMEOUT_SECONDS, remaining),
                )
            )
            if rendered:
                return rendered

    fallback = Path.home() / "ai-now" / "memory.md"
    try:
        return fallback.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        return ""


def _write_hook_response(event_name: str, additional_context: str) -> None:
    response = {
        "continue": True,
        "suppressOutput": True,
        "hookSpecificOutput": {
            "hookEventName": event_name,
            "additionalContext": additional_context,
        },
    }
    # ASCII-safe JSON avoids Windows console-codepage failures; JSON decoding
    # restores the original Unicode context inside Codex.
    json.dump(response, sys.stdout, ensure_ascii=True)
    sys.stdout.write("\n")


def main(payload: dict[str, Any] | None = None) -> int:
    payload = _read_hook_input() if payload is None else payload
    event_name = str(payload.get("hook_event_name") or "SessionStart")
    guidance = (
        PROMPT_ROUTING_GUIDANCE
        if event_name == "UserPromptSubmit"
        else ROUTING_GUIDANCE.strip()
    )
    context_parts = [guidance]
    if event_name == "SessionStart":
        startup_context = _load_startup_context()
        if startup_context:
            context_parts.extend(["## Current Nowledge context", startup_context])
    _write_hook_response(event_name, "\n\n".join(context_parts))
    return 0


if __name__ == "__main__":
    hook_payload = _read_hook_input()
    hook_event_name = str(hook_payload.get("hook_event_name") or "SessionStart")
    try:
        raise SystemExit(main(hook_payload))
    except Exception:
        # Lifecycle guidance must never block the user's Codex task.
        guidance = (
            PROMPT_ROUTING_GUIDANCE
            if hook_event_name == "UserPromptSubmit"
            else ROUTING_GUIDANCE.strip()
        )
        _write_hook_response(hook_event_name, guidance)
        raise SystemExit(0)
