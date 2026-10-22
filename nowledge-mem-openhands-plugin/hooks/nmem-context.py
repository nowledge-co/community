#!/usr/bin/env python3
"""OpenHands UserPromptSubmit hook: Injects Nowledge Mem context into conversation."""

from __future__ import annotations

import os
import sys
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


def main() -> None:
    try:
        hook_input = nmem_shared.read_hook_input()

        # An explicitly disabled prompt hook must not touch the host's skill
        # links, MCP files, or network configuration.
        if os.environ.get("NMEM_DISABLE_PROMPT_INJECT", "").strip().lower() in ("1", "true", "yes"):
            nmem_shared.emit({})
            sys.exit(0)

        # 1. Asynchronously sync host skills, retry offline queue, and sync MCP configuration
        try:
            nmem_shared.sync_host_skills_async()
            nmem_shared.retry_unsynced_sessions_async()
            nmem_shared.sync_mcp_config_file()
        except Exception:
            pass

        working_dir = (
            hook_input.get("working_dir")
            or os.environ.get("OPENHANDS_PROJECT_DIR", "")
            or os.getcwd()
        )

        session_key = nmem_shared.resolve_session_key(hook_input, working_dir)

        # If prompt guidance only is requested, bypass context bundle entirely
        if os.environ.get("NMEM_PROMPT_GUIDANCE_ONLY", "").strip().lower() in ("1", "true", "yes"):
            nmem_shared.mark_session_injected(session_key, working_dir)
            nmem_shared.emit({"additionalContext": PROMPT_ROUTING_GUIDANCE})
            sys.exit(0)

        # Check if this session already received the initial Context Bundle
        already_injected = nmem_shared.has_session_injected(session_key, working_dir)

        if already_injected:
            # Subsequent turns receive lightweight guidance to preserve token budget
            nmem_shared.emit({"additionalContext": PROMPT_ROUTING_GUIDANCE})
            sys.exit(0)

        # Load full startup context
        startup_context = nmem_shared.read_startup_context(working_dir)
        if not startup_context:
            nmem_shared.emit({"additionalContext": PROMPT_ROUTING_GUIDANCE})
            sys.exit(0)

        # Mark session injected only after successfully retrieving startup context
        nmem_shared.mark_session_injected(session_key, working_dir)

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
