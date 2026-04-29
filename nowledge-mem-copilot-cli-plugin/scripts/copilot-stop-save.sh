#!/usr/bin/env bash
# Compatibility launcher for the packaged Copilot capture hook.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "${SCRIPT_DIR}/../hooks/copilot-stop-save.sh" "$@"
