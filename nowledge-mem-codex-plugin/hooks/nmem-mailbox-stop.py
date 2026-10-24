#!/usr/bin/env python3
"""Offer one passive mailbox check at the end of a normal Codex turn."""

from __future__ import annotations

import json
import os
from pathlib import Path

from nmem_mailbox_stop import build_stop_response, eligible, read_event
from nmem_runtime import build_nmem_command, find_nmem_command


def main() -> dict:
    event = read_event()
    if not eligible(event):
        return {}
    nmem = find_nmem_command()
    if not nmem:
        return {}
    root = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    return build_stop_response(
        event,
        host="codex",
        command=lambda args: build_nmem_command(nmem, *args),
        state_root=root / "nowledge-mem" / "mailbox-stop",
    )


if __name__ == "__main__":
    try:
        response = main()
    except Exception:
        response = {}
    print(json.dumps(response))
