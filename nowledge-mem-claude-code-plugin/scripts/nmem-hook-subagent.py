#!/usr/bin/env python3
"""Inject bounded Nowledge context into a Claude Code subagent."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


SUBAGENT_CONTEXT_TIMEOUT_SECONDS = 4.0
SUBAGENT_CONTEXT_MAX_BYTES = 4 * 1024
DEFAULT_SUBAGENT_CONTEXT_TYPES = frozenset(
    {"Plan", "code-reviewer", "architect", "researcher"}
)
SUBAGENT_ROUTING_GUIDANCE = """## Nowledge Mem subagent routing

You are working in an isolated subagent context. For continuation or
prior-decision work, run one targeted search before concluding: prefer Nowledge
`memory_search` / `thread_search` when available, otherwise use
`nmem --json m search` / `nmem --json t search`. Do not distill speculative
intermediate findings into durable memory. Preserve the configured Nowledge AI
Identity; the host-generated child id is transient provenance."""
SUBAGENT_CONTEXT_GUIDANCE = """Treat the injected Nowledge context as a starting
point, not complete evidence."""

_READ_HOOK = Path(__file__).resolve().with_name("nmem-hook-read.sh")


def _read_hook_input() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _load_context() -> str:
    shell = shutil.which("sh")
    if not shell or not _READ_HOOK.is_file():
        return ""
    try:
        result = subprocess.run(
            [shell, str(_READ_HOOK)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=SUBAGENT_CONTEXT_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def _context_types() -> frozenset[str]:
    configured = os.environ.get("NMEM_SUBAGENT_CONTEXT_TYPES")
    if configured is None:
        return DEFAULT_SUBAGENT_CONTEXT_TYPES
    return frozenset(
        agent_type.strip()
        for agent_type in configured.split(",")
        if agent_type.strip()
    )


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


def _write_response(additional_context: str) -> None:
    response = {
        "hookSpecificOutput": {
            "hookEventName": "SubagentStart",
            "additionalContext": additional_context,
        }
    }
    json.dump(response, sys.stdout, ensure_ascii=True)
    sys.stdout.write("\n")


def main(payload: dict[str, Any] | None = None) -> int:
    if payload is None:
        payload = _read_hook_input()

    agent_type = str(payload.get("agent_type") or "").strip()
    context_types = _context_types()
    if agent_type not in context_types:
        if agent_type == "Explore":
            return 0
        _write_response(SUBAGENT_ROUTING_GUIDANCE.strip())
        return 0

    context_parts = [
        SUBAGENT_ROUTING_GUIDANCE.strip(),
        SUBAGENT_CONTEXT_GUIDANCE.strip(),
    ]
    current_context = _load_context()
    if current_context:
        context_parts.extend(["## Current Nowledge context", current_context])
    additional_context = _truncate_utf8(
        "\n\n".join(context_parts), SUBAGENT_CONTEXT_MAX_BYTES
    )
    _write_response(additional_context)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        _write_response(SUBAGENT_ROUTING_GUIDANCE.strip())
        raise SystemExit(0)
