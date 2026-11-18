#!/usr/bin/env python3
"""Expose only a bounded local Bridge arrival hint at a supported hook."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nmem_bridge_notice import read_event, response


def main() -> dict:
    if os.environ.get("GROK_PLUGIN_ROOT"):
        return {}
    event = read_event()
    if event.get("hook_event_name") == "SessionEnd":
        from nmem_bridge_lifecycle import close_session

        close_session(event, "claude-code")
        return {}
    return response(event, host="claude-code")


if __name__ == "__main__":
    try:
        result = main()
    except Exception:
        result = {}
    print(json.dumps(result))
