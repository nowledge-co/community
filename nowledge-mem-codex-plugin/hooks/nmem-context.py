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
SUBAGENT_CONTEXT_TOTAL_TIMEOUT_SECONDS = 4.0
SUBAGENT_CONTEXT_ATTEMPT_TIMEOUT_SECONDS = 3.0
SUBAGENT_CONTEXT_MAX_BYTES = 4 * 1024
DEFAULT_SUBAGENT_CONTEXT_TYPES = frozenset(
    {"planner", "code-reviewer", "architect", "researcher"}
)
ROUTING_GUIDANCE = """## Nowledge Mem routing

Codex local Memory and Nowledge Mem are separate. Treat Codex local Memory as a convenient local hint; use Nowledge Mem as the source for cross-tool context, current Working Memory, exact prior threads, and sourced decisions. For continuation, review, regression, release, connector, prior-decision, or exact-history work, run one targeted Nowledge memory or thread search before concluding. Do not skip that search only because Codex local Memory contains a related summary. Prefer Nowledge MCP tools when available and distill durable new decisions back to Nowledge Mem.
"""
PROMPT_ROUTING_GUIDANCE = """Codex local Memory is only a local hint. For continuation, review, regression, release, connector, prior-decision, cross-tool, or exact-history work, search Nowledge memory or threads once before concluding; do not let a Codex Memory summary replace that search."""
SUBAGENT_ROUTING_GUIDANCE = """### Isolated subagent boundary

You are working in an isolated subagent context. For continuation or
prior-decision work, run one targeted search before concluding: prefer Nowledge
`memory_search` / `thread_search` when available, otherwise use
`nmem --json m search` / `nmem --json t search`. Do not distill speculative
intermediate findings into durable memory. Preserve the configured Nowledge AI
Identity; the host-generated child id is transient provenance."""
SUBAGENT_CONTEXT_GUIDANCE = """Treat the injected Nowledge context as a starting
point, not complete evidence. Do not reload Working Memory separately when the
Context Bundle already contains it."""


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


def _load_startup_context(
    *,
    total_timeout_seconds: float = CONTEXT_TOTAL_TIMEOUT_SECONDS,
    attempt_timeout_seconds: float = CONTEXT_ATTEMPT_TIMEOUT_SECONDS,
) -> str:
    nmem = _nmem_command()
    if nmem:
        deadline = time.monotonic() + total_timeout_seconds
        for args in (_context_args(), _working_memory_args()):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            rendered = _rendered_context(
                _run_nmem_json(
                    nmem,
                    args,
                    timeout_seconds=min(attempt_timeout_seconds, remaining),
                )
            )
            if rendered:
                return rendered

    fallback = Path.home() / "ai-now" / "memory.md"
    try:
        return fallback.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        return ""


def _truncate_utf8(value: str, max_bytes: int) -> str:
    encoded = value.encode("utf-8")
    if len(encoded) <= max_bytes:
        return value

    marker = "\n\n[Nowledge Mem context truncated for subagent.]"
    marker_bytes = marker.encode("utf-8")
    if max_bytes <= len(marker_bytes):
        return marker_bytes[:max_bytes].decode("utf-8", errors="ignore")

    body = encoded[: max_bytes - len(marker_bytes)].decode(
        "utf-8", errors="ignore"
    )
    return body.rstrip() + marker


def _subagent_context_types() -> frozenset[str]:
    configured = os.environ.get("NMEM_SUBAGENT_CONTEXT_TYPES")
    if configured is None:
        return DEFAULT_SUBAGENT_CONTEXT_TYPES
    return frozenset(
        value.strip() for value in configured.split(",") if value.strip()
    )


def _subagent_routing_context() -> str:
    return "\n\n".join(
        (ROUTING_GUIDANCE.strip(), SUBAGENT_ROUTING_GUIDANCE.strip())
    )


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
    if event_name == "UserPromptSubmit":
        guidance = PROMPT_ROUTING_GUIDANCE
    elif event_name == "SubagentStart":
        agent_type = str(payload.get("agent_type") or "default").strip()
        if agent_type not in _subagent_context_types():
            if agent_type == "explorer":
                return 0
            _write_hook_response(event_name, _subagent_routing_context())
            return 0
        guidance = "\n\n".join(
            (_subagent_routing_context(), SUBAGENT_CONTEXT_GUIDANCE.strip())
        )
    else:
        guidance = ROUTING_GUIDANCE.strip()

    context_parts = [guidance]
    if event_name == "SessionStart":
        startup_context = _load_startup_context()
        if startup_context:
            context_parts.extend(["## Current Nowledge context", startup_context])
    elif event_name == "SubagentStart":
        startup_context = _load_startup_context(
            total_timeout_seconds=SUBAGENT_CONTEXT_TOTAL_TIMEOUT_SECONDS,
            attempt_timeout_seconds=SUBAGENT_CONTEXT_ATTEMPT_TIMEOUT_SECONDS,
        )
        if startup_context:
            context_parts.extend(["## Current Nowledge context", startup_context])

    additional_context = "\n\n".join(context_parts)
    if event_name == "SubagentStart":
        additional_context = _truncate_utf8(
            additional_context, SUBAGENT_CONTEXT_MAX_BYTES
        )
    _write_hook_response(event_name, additional_context)
    return 0


if __name__ == "__main__":
    hook_payload = _read_hook_input()
    hook_event_name = str(hook_payload.get("hook_event_name") or "SessionStart")
    try:
        raise SystemExit(main(hook_payload))
    except Exception:
        # Lifecycle guidance must never block the user's Codex task.
        if hook_event_name == "UserPromptSubmit":
            guidance = PROMPT_ROUTING_GUIDANCE
        elif hook_event_name == "SubagentStart":
            agent_type = str(hook_payload.get("agent_type") or "default").strip()
            if (
                agent_type == "explorer"
                and agent_type not in _subagent_context_types()
            ):
                raise SystemExit(0)
            guidance = _subagent_routing_context()
        else:
            guidance = ROUTING_GUIDANCE.strip()
        if hook_event_name == "SubagentStart":
            guidance = _truncate_utf8(guidance, SUBAGENT_CONTEXT_MAX_BYTES)
        _write_hook_response(hook_event_name, guidance)
        raise SystemExit(0)
