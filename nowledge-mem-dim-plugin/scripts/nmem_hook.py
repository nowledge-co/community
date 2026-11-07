#!/usr/bin/env python3
"""SessionStart and UserPromptSubmit hooks for Dim.

SessionStart loads the Nowledge Mem Context Bundle (or Working Memory) once,
under a 10 s budget, and injects a bounded briefing plus the routing text.
UserPromptSubmit injects only the static routing text and never runs a CLI.
Both fail open: an unreachable Mem, a missing CLI or a slow call leaves the
turn untouched.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Isolated Python omits the installed script directory from its import path.
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

import nmem_common

TOTAL_TIMEOUT_SECONDS = 10.0
ATTEMPT_TIMEOUT_SECONDS = 7.0
MAX_CONTEXT_BYTES = 15 * 1024

ROUTING = (
    "[Nowledge Mem] Durable memory is available across tools. For continuation, "
    "review, regression, release, connector, prior-decision, or exact-history "
    "work, use a Mem MCP tool whose description reads memory search or thread "
    "search before concluding; when no Mem tool is available, use the `nmem` "
    "CLI. The startup snapshot below is a briefing, not a substitute for that "
    "search, and it can be stale after a resume or compaction; read Working "
    "Memory again for the current view (the Mem Working Memory tool, or `nmem "
    "wm read`). Keep the configured identity and Space. If retrieval is "
    "unavailable, say so briefly and continue; do not report a failed search "
    "as no matches. Save durable decisions and learnings when they are worth "
    "keeping, with the Mem save tool or `nmem m add`. Skip retrieval for "
    "trivial, independent tasks or an explicit fresh start."
)

# Dim appends this inside every operator message, so it stays in the history
# and is resent with every later request. Keep it to the routing decision.
PROMPT_GUIDANCE = (
    "[Nowledge Mem] Before concluding work that depends on prior context, run "
    "one targeted memory or thread search. The startup briefing can be stale; "
    "read Working Memory again for the current view. Keep the configured "
    "identity and Space. Report retrieval failures briefly, never as no matches."
)


def bound(text: str, limit: int) -> str:
    """Truncates at a character boundary without exceeding `limit` bytes."""
    encoded = text.encode("utf-8")
    if len(encoded) <= limit:
        return text
    marker = "\n\n[context truncated]"
    room = max(0, limit - len(marker.encode("utf-8")))
    cut = encoded[:room].decode("utf-8", "ignore")
    return cut + marker


def context_attempts(nmem: str, deadline: float) -> List[Tuple[List[str], str]]:
    selectors, agent_id, resolved = nmem_common.space_selectors(
        nmem, max(0.5, min(3.0, deadline - time.monotonic()))
    )
    if not resolved:
        return []
    if os.environ.get("NMEM_AGENT_CONTEXT", "").strip():
        return [(["--json", "wm", "read"] + selectors, "Working Memory")]
    context_args = ["--json", "context", "--source-app", "dim"] + selectors
    for env_name, flag in (
        ("NMEM_AGENT_ID", "--agent-id"),
        ("NMEM_HOST_AGENT_ID", "--host-agent-id"),
    ):
        value = os.environ.get(env_name, "").strip()
        if value:
            context_args.extend([flag, value])
    attempts = [(context_args, "Context Bundle")]
    if selectors or not agent_id:
        attempts.append((["--json", "wm", "read"] + selectors, "Working Memory"))
    return attempts


def load_context(nmem: str, deadline: float) -> Tuple[str, str, str]:
    """Returns (text, source, reason); text is empty when nothing loaded."""
    reason = "unavailable"
    if not nmem:
        return "", "", "cli_unavailable"
    for args, source in context_attempts(nmem, deadline):
        remaining = deadline - time.monotonic()
        if remaining <= 0.5:
            return "", "", "timeout"
        ok, payload = nmem_common.run_json(nmem, args, min(ATTEMPT_TIMEOUT_SECONDS, remaining))
        if not ok:
            reason = "invalid_response"
            continue
        if payload.get("exists") is False:
            reason = "no_briefing"
            continue
        for key in ("rendered_markdown", "content"):
            content = payload.get(key)
            if isinstance(content, str) and content.strip():
                return content.strip(), source, ""
        reason = "no_briefing"
    return "", "", reason


def main() -> int:
    event = nmem_common.read_event()
    hook = sys.argv[1] if len(sys.argv) > 1 else ""
    session_id = nmem_common.event_text(event, "session_id")
    if hook == "prompt":
        if not session_id:
            nmem_common.log({"hook": "prompt", "status": "bad_event"})
            return 0
        sys.stdout.write(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "UserPromptSubmit",
                        "additionalContext": PROMPT_GUIDANCE,
                    }
                },
                ensure_ascii=True,
            )
        )
        sys.stdout.write("\n")
        return 0
    if hook != "context":
        return 0
    if not session_id:
        nmem_common.log({"hook": "startup", "status": "bad_event"})
        return 0
    started = time.monotonic()
    deadline = started + TOTAL_TIMEOUT_SECONDS
    nmem = nmem_common.find_nmem()
    text, source, reason = load_context(nmem, deadline)
    if not text:
        nmem_common.log(
            {"hook": "startup", "status": "unavailable", "reason": reason}
        )
        return 0
    content = ROUTING + "\n\n## Current Nowledge context\n\n" + text
    content = bound(content, MAX_CONTEXT_BYTES)
    sys.stdout.write(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": content,
                }
            },
            ensure_ascii=True,
        )
    )
    sys.stdout.write("\n")
    nmem_common.log(
        {
            "hook": "startup",
            "status": "loaded",
            "source": source,
            "ms": int((time.monotonic() - started) * 1000),
        }
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError):
        sys.exit(0)
