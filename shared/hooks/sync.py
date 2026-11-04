#!/usr/bin/env python3
"""Ship the canonical mailbox helper inside each standalone plugin package."""

import argparse
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    options = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    failed = False
    for filename in ("nmem_mailbox_stop.py", "nmem_startup.py"):
        source = Path(__file__).with_name(filename).read_bytes()
        targets = (
            root / "nowledge-mem-codex-plugin/hooks" / filename,
            root / "nowledge-mem-claude-code-plugin/scripts" / filename,
        )
        for target in targets:
            if options.write:
                target.write_bytes(source)
            if not target.is_file() or target.read_bytes() != source:
                print(f"Stale packaged mailbox helper: {target.relative_to(root)}")
                failed = True
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
