#!/usr/bin/env python3
"""Ship the canonical mailbox helper inside each standalone plugin package."""

import argparse
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    options = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    source = Path(__file__).with_name("nmem_mailbox_stop.py").read_bytes()
    targets = (
        root / "nowledge-mem-codex-plugin/hooks/nmem_mailbox_stop.py",
        root / "nowledge-mem-claude-code-plugin/scripts/nmem_mailbox_stop.py",
    )
    failed = False
    for target in targets:
        if options.write:
            target.write_bytes(source)
        if not target.is_file() or target.read_bytes() != source:
            print(f"Stale packaged mailbox helper: {target.relative_to(root)}")
            failed = True
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
