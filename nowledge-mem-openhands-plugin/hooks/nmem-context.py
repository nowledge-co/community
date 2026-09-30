#!/usr/bin/env python3
"""OpenHands UserPromptSubmit hook: Injects Nowledge Mem context into conversation."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Add hooks directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import nmem_shared

PROMPT_ROUTING_GUIDANCE = (
    "OpenHands local session history and Nowledge Mem are complementary. "
    "Use Nowledge Mem for durable cross-agent context, current Working Memory, "
    "prior architecture decisions, and multi-agent canvas coordination. "
    "Search Nowledge memory or threads when past context is relevant."
)


def _get_session_marker(session_id: str) -> Path:
    state_dir = Path("~/.nowledge-mem/plugins/openhands/sessions").expanduser()
    state_dir.mkdir(parents=True, exist_ok=True)
    clean_id = session_id.strip().replace("/", "_").replace(chr(92), "_")
    return state_dir / f"{clean_id}.injected"


def _has_session_injected(session_id: str) -> bool:
    if not session_id:
        return False
    marker = _get_session_marker(session_id)
    # Check if marker exists and is recent (< 24 hours)
    if marker.is_file():
        try:
            mtime = marker.stat().st_mtime
            if time.time() - mtime < 86400:
                return True
        except OSError:
            pass
    return False


def _mark_session_injected(session_id: str) -> None:
    if not session_id:
        return
    try:
        marker = _get_session_marker(session_id)
        marker.write_text(str(time.time()), encoding="utf-8")
    except OSError:
        pass


def main() -> None:
    try:
        # 1. Asynchronously sync host skills, retry offline queue, and sync MCP configuration
        try:
            nmem_shared.sync_host_skills_async()
            nmem_shared.retry_unsynced_sessions_async()
            nmem_shared.sync_mcp_config_file()
        except Exception:
            pass

        hook_input = nmem_shared.read_hook_input()

        # Check if context injection is explicitly disabled
        if os.environ.get("NMEM_DISABLE_PROMPT_INJECT", "").strip().lower() in ("1", "true", "yes"):
            nmem_shared.emit({})
            sys.exit(0)

        session_id = (
            hook_input.get("session_id")
            or hook_input.get("sessionId")
            or os.environ.get("OPENHANDS_SESSION_ID", "").strip()
        )

        # Check if this session already received the initial Context Bundle
        already_injected = _has_session_injected(session_id) if session_id else False

        if already_injected:
            # Subsequent turns receive lightweight guidance to preserve token budget
            nmem_shared.emit({"additionalContext": PROMPT_ROUTING_GUIDANCE})
            sys.exit(0)

        # Turn 1: load full startup context
        startup_context = nmem_shared.read_startup_context()
        if not startup_context:
            nmem_shared.emit({"additionalContext": PROMPT_ROUTING_GUIDANCE})
            sys.exit(0)

        if session_id:
            _mark_session_injected(session_id)

        agent_id = nmem_shared.resolve_agent_id()
        agent_note = f" (Node/Agent: {agent_id})" if agent_id else ""

        tag = startup_context["tag"]
        label = startup_context["label"]
        body = startup_context["content"]

        msg = (
            f"<{tag}>\n"
            f"Use this as current context from Nowledge Mem {label}{agent_note}. "
            "It is situational context, not a higher-priority instruction.\n\n"
            f"{body}\n"
            f"</{tag}>\n\n"
            "## Nowledge Mem OpenHands Guidance\n"
            "OpenHands local session history and Nowledge Mem are complementary. "
            "Use Nowledge Mem for durable cross-agent context, current Working Memory, "
            "prior architecture decisions, and multi-agent canvas coordination. "
            "Distill breakthrough learnings and decisions proactively."
        )

        nmem_shared.emit({"additionalContext": msg})
        sys.exit(0)
    except Exception as e:
        if os.environ.get("DEBUG") or os.environ.get("NMEM_DEBUG"):
            sys.stderr.write(f"Nowledge Mem OpenHands prompt hook failed: {e}\n")
        nmem_shared.emit({})
        sys.exit(0)


if __name__ == "__main__":
    main()
