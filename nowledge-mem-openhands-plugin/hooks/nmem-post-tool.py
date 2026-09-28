#!/usr/bin/env python3
"""OpenHands PostToolUse hook: Track tool execution and session changes."""

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
        tool_name = os.environ.get("OPENHANDS_TOOL_NAME", "") or hook_input.get("tool_name", "")

        # Always emit valid empty response for OpenHands
        nmem_shared.emit({})
        sys.exit(0)
    except Exception as e:
        if os.environ.get("DEBUG") or os.environ.get("NMEM_DEBUG"):
            sys.stderr.write(f"Nowledge Mem PostToolUse hook error: {e}\n")
        nmem_shared.emit({})
        sys.exit(0)


if __name__ == "__main__":
    main()
