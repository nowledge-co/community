#!/usr/bin/env python3
"""Compatibility launcher for the packaged Copilot capture hook."""

from __future__ import annotations

import runpy
from pathlib import Path


if __name__ == "__main__":
    hook_script = Path(__file__).resolve().parent.parent / "hooks" / "copilot-stop-save.py"
    runpy.run_path(str(hook_script), run_name="__main__")
