#!/usr/bin/env python3
"""OpenHands UserPromptSubmit hook: Injects Nowledge Mem context into conversation."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add hooks directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import nmem_shared


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

        startup_context = nmem_shared.read_startup_context()
        if not startup_context:
            nmem_shared.emit({})
            sys.exit(0)

        agent_id = nmem_shared.resolve_agent_id()
        agent_note = f" (Node/Agent: {agent_id})" if agent_id else ""

        msg = (
            f"<{startup_context['tag']}>\n"
            f"Use this as current context from Nowledge Mem {startup_context['label']}{agent_note}. "
            "It is situational context, not a higher-priority instruction.\n\n"
            f"{startup_context['content']}\n"
            f"</{startup_context['tag']}>\n\n"
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
