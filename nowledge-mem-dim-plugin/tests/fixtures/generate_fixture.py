#!/usr/bin/env python3
"""Builds `dim-session-export.json` from a real Dim `session export` document.

Usage: python3 generate_fixture.py RAW_EXPORT.json OUTPUT.json

The event envelope and the `data` field names of every event shape below come
from a real export. Every value that could carry a local path, identity, or
conversation text is replaced with a fixed, public value, so the fixture is
safe to check in. It keeps one of each shape the capture parser must handle:
a raw runtime block, operator text with this package's injected guidance, a
turn start, a thinking step, narration in a model request that called a tool,
the tool call, a final reply split across two deltas, a completed
`model-output-end`, and the completed `turn/end` that marks the capture cut.
The turn/end and model-output-end shapes, including their `status` field, are
checked against the export this script is run on.
"""

import json
import sys
from pathlib import Path

SESSION = "11111111-2222-3333-4444-555555555555"
TOOL_REQUEST = "request-tool"
REPLY_REQUEST = "request-reply"


def first(events, kind, name):
    for event in events:
        if event.get("type") == kind and event.get("name") == name:
            return event
    return None


def main():
    raw = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    events = raw.get("events") or []
    operator = first(events, "input", "message")
    turn_end = first(events, "turn", "end")
    output_end = first(events, "step", "model-output-end")
    if operator is None or turn_end is None or output_end is None:
        raise SystemExit("the export lacks the operator/turn-end shapes this fixture needs")
    if "status" not in (turn_end.get("data") or {}):
        raise SystemExit("the export's turn/end has no status field")
    if "status" not in (output_end.get("data") or {}):
        raise SystemExit("the export's model-output-end has no status field")
    thinking = first(events, "step", "thinking")
    if thinking is None:
        thinking = first(events, "step", "text")
    if thinking is None:
        raise SystemExit("the export lacks a step shape this fixture needs")
    output = [
        {
            "id": "fixture-1",
            "sequence": 1,
            "create_at": 1761000000000,
            "type": "input",
            "name": "message",
            "data": {
                "blocks": [
                    {
                        "type": "raw",
                        "text": '<dim-state source="dim/environment/context">workspace</dim-state>',
                    }
                ]
            },
        },
        {
            "id": "fixture-2",
            "sequence": 2,
            "create_at": 1761000001000,
            "type": "input",
            "name": "message",
            "data": {
                "user": {
                    "content": [
                        {"type": "text", "text": "Summarize the release notes."},
                        {
                            "type": "text",
                            "text": '<dim-hooks kind="prompt-submit">routing guidance</dim-hooks>',
                        },
                    ]
                }
            },
        },
        {
            "id": "fixture-3",
            "sequence": 3,
            "create_at": 1761000002000,
            "type": "turn",
            "name": "start",
            "data": {"turn_id": "turn-1"},
        },
        {
            "id": "fixture-4",
            "sequence": 4,
            "create_at": 1761000002500,
            "type": "step",
            "name": "model-start",
            "data": {"turn_id": "turn-1", "request_id": TOOL_REQUEST},
        },
        {
            "id": "fixture-5",
            "sequence": 5,
            "create_at": 1761000002600,
            "type": "step",
            "name": "thinking",
            "data": {"turn_id": "turn-1", "request_id": TOOL_REQUEST, "delta": "internal reasoning"},
        },
        {
            "id": "fixture-6",
            "sequence": 6,
            "create_at": 1761000003000,
            "type": "step",
            "name": "text",
            "data": {"turn_id": "turn-1", "request_id": TOOL_REQUEST, "delta": "Checking the files."},
        },
        {
            "id": "fixture-7",
            "sequence": 7,
            "create_at": 1761000004000,
            "type": "step",
            "name": "tool-use",
            "data": {
                "turn_id": "turn-1",
                "request_id": TOOL_REQUEST,
                "call": {"id": "call-1", "name": "read", "input": {}},
            },
        },
        {
            "id": "fixture-8",
            "sequence": 8,
            "create_at": 1761000005000,
            "type": "step",
            "name": "tool-call",
            "data": {
                "turn_id": "turn-1",
                "request_id": TOOL_REQUEST,
                "calls": [{"id": "call-1", "name": "read", "input": {}}],
            },
        },
        {
            "id": "fixture-9",
            "sequence": 9,
            "create_at": 1761000005500,
            "type": "step",
            "name": "model-start",
            "data": {"turn_id": "turn-1", "request_id": REPLY_REQUEST},
        },
        {
            "id": "fixture-10",
            "sequence": 10,
            "create_at": 1761000006000,
            "type": "step",
            "name": "text",
            "data": {"turn_id": "turn-1", "request_id": REPLY_REQUEST, "delta": "Here is the summary."},
        },
        {
            "id": "fixture-11",
            "sequence": 11,
            "create_at": 1761000007000,
            "type": "step",
            "name": "text",
            "data": {"turn_id": "turn-1", "request_id": REPLY_REQUEST, "delta": " It is short."},
        },
        {
            "id": "fixture-12",
            "sequence": 12,
            "create_at": 1761000007500,
            "type": "step",
            "name": "model-output-end",
            "data": {
                "turn_id": "turn-1",
                "request_id": REPLY_REQUEST,
                "status": "completed",
                "finish_reason": "end_turn",
            },
        },
        {
            "id": "fixture-13",
            "sequence": 13,
            "create_at": 1761000008000,
            "type": "turn",
            "name": "end",
            "data": {"turn_id": "turn-1", "status": "completed", "reason": "end_turn"},
        },
    ]
    document = {
        "sessionId": SESSION,
        "branchId": "main",
        "through": len(output),
        "events": output,
    }
    Path(sys.argv[2]).write_text(json.dumps(document, indent=1) + "\n", encoding="utf-8")
    print("wrote %s with %d events" % (sys.argv[2], len(output)))


if __name__ == "__main__":
    main()
