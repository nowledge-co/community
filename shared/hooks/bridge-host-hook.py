"""Adapt supported Claude-shaped lifecycle events to local Bridge notices."""

import json
import os
import sys

from agent_bridge_notices import bridge_notice_hint, bridge_session_hint, close_bridge_session


def main():
    if len(sys.argv) != 2 or sys.argv[1] != "codebuddy":
        return
    host = sys.argv[1]
    try:
        raw = sys.stdin.buffer.read(256 * 1024 + 1)
        event = json.loads(raw) if len(raw) <= 256 * 1024 else {}
    except (OSError, ValueError):
        event = {}
    if not isinstance(event, dict):
        event = {}
    name, session = event.get("hook_event_name"), event.get("session_id")
    hint = ""
    if name == "SessionEnd":
        close_bridge_session(host, session)
    elif name == "UserPromptSubmit":
        hint = bridge_notice_hint(host, session)
    elif name == "SessionStart" and os.environ.get("NMEM_BRIDGE_INBOX_ON_START") == "1" and os.environ.get("NMEM_AGENT_CONTEXT", "").strip():
        hint = bridge_session_hint(host, session)
    print(json.dumps({"hookSpecificOutput": {"hookEventName": name, "additionalContext": hint}} if hint else {}))


if __name__ == "__main__":
    main()
