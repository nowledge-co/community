#!/usr/bin/env python3
"""Cross-platform launcher for the packaged Codex Stop hook."""

from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


def _stable_host_hook() -> Path:
    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home).expanduser() / "hooks" / "nowledge-mem-stop-save.py"
    return Path.home() / ".codex" / "hooks" / "nowledge-mem-stop-save.py"


def _packaged_hook() -> Path:
    return Path(__file__).resolve().with_name("nmem-stop-save.py")


def main() -> int:
    hook = _stable_host_hook()
    if not hook.is_file():
        hook = _packaged_hook()

    sys.argv = [str(hook), *sys.argv[1:]]
    runpy.run_path(str(hook), run_name="__main__")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
