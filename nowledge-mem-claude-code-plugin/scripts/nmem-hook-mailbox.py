#!/usr/bin/env python3
"""Offer one passive mailbox check at the end of a normal Claude Code turn."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from nmem_mailbox_stop import build_stop_response, eligible, read_event


def main() -> dict:
    event = read_event()
    if not eligible(event):
        return {}
    spec = importlib.util.spec_from_file_location(
        "nmem_mailbox_context",
        Path(__file__).with_name("nmem-hook-context.py"),
    )
    context = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = context
    spec.loader.exec_module(context)
    if context.is_grok_runtime():
        return {}
    nmem = context.find_nmem()
    if not nmem:
        return {}
    root = Path(
        os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude"
    ).expanduser()
    return build_stop_response(
        event,
        host="claude-code",
        command=lambda args: context.command_args(nmem, args),
        state_root=root / "nowledge-mem" / "mailbox-stop",
    )


if __name__ == "__main__":
    try:
        response = main()
    except Exception:
        response = {}
    print(json.dumps(response))
