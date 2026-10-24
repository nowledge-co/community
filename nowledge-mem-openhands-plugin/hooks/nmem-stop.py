#!/usr/bin/env python3
"""OpenHands Stop hook: Capture conversation session or thread state upon completion."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add hooks directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import nmem_shared


def main() -> None:
    try:
        hook_input = nmem_shared.read_hook_input()

        conversation_id = nmem_shared.resolve_session_id(hook_input)
        working_dir = (
            hook_input.get("working_dir")
            or os.environ.get("OPENHANDS_PROJECT_DIR", "")
            or os.getcwd()
        )

        # Stop fires at the end of every agent turn (reason="agent_finished") and the next
        # message continues the same conversation, so it must not reset the prompt-injection
        # marker. Markers expire by TTL; see nmem_shared.has_session_injected.

        if os.environ.get("NMEM_DISABLE_AUTO_CAPTURE", "").strip().lower() in ("1", "true", "yes"):
            nmem_shared.emit({"decision": "approve"})
            sys.exit(0)

        space = nmem_shared.resolve_space(working_dir)
        agent_id = nmem_shared.resolve_agent_id()

        # Synchronize OpenHands conversation session into Nowledge Mem
        if conversation_id:
            nmem_shared.sync_openhands_thread(
                str(conversation_id),
                working_dir=working_dir,
                space=space,
                agent_id=agent_id,
                hook_input=hook_input,
            )
            nmem_shared.flush_unsynced_sessions(working_dir)

        nmem_shared.emit({"decision": "approve"})
        sys.exit(0)
    except Exception as e:
        if os.environ.get("DEBUG") or os.environ.get("NMEM_DEBUG"):
            sys.stderr.write(f"Nowledge Mem Stop hook error: {e}\n")
        nmem_shared.emit({"decision": "approve"})
        sys.exit(0)


if __name__ == "__main__":
    main()
