#!/usr/bin/env python3
"""Emit a Bridge reminder on the first supported Kimi prompt for a session."""

import argparse
import hashlib
import json
import sys
from pathlib import Path

from agent_bridge_startup import bridge_startup_hint


def claim_session(host, session_id):
    state = Path.home() / ".nowledge-mem" / "bridge-startup" / host
    digest = hashlib.sha256(session_id.encode("utf-8")).hexdigest()
    try:
        state.mkdir(mode=0o700, parents=True, exist_ok=True)
        with (state / digest).open("x"):
            pass
    except OSError:
        return False

    try:
        markers = sorted(state.iterdir(), key=lambda path: path.stat().st_mtime_ns)
        for old in markers[:-256]:
            if old.name != digest and len(old.name) == 64:
                old.unlink(missing_ok=True)
    except OSError:
        pass
    return True


def main():
    hint = bridge_startup_hint()
    if not hint:
        return
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("host", choices=("kimi-code", "kimi-work"))
    host = parser.parse_args().host
    try:
        payload = json.loads(sys.stdin.buffer.read(256 * 1024 + 1))
    except (ValueError, OSError):
        return
    if not isinstance(payload, dict) or payload.get("hook_event_name") != "UserPromptSubmit":
        return
    session_id = payload.get("session_id")
    if isinstance(session_id, str) and 0 < len(session_id) <= 1024 and claim_session(host, session_id):
        print(hint)


if __name__ == "__main__":
    main()
