#!/usr/bin/env bash
# Shell launcher for copilot-stop-save.py
# Called by hooks.json Stop event — receives JSON via stdin.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec python3 "${SCRIPT_DIR}/copilot-stop-save.py"
