#!/usr/bin/env bash
# install-hooks.sh — Idempotent installer for Copilot CLI session capture hooks.
#
# Copies the Python capture script and shell launcher to
# ~/.copilot/nowledge-mem-hooks/ so the hooks.json Stop event can find them.
# Safe to run multiple times (idempotent).
set -euo pipefail

HOOK_DIR="${HOME}/.copilot/nowledge-mem-hooks"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Nowledge Mem Copilot CLI hooks..."

# Create directories
mkdir -p "${HOOK_DIR}/state"

# Copy scripts
cp -f "${SCRIPT_DIR}/copilot-stop-save.py" "${HOOK_DIR}/copilot-stop-save.py"
cp -f "${SCRIPT_DIR}/copilot-stop-save.sh" "${HOOK_DIR}/copilot-stop-save.sh"

# Ensure executable
chmod +x "${HOOK_DIR}/copilot-stop-save.sh"
chmod +x "${HOOK_DIR}/copilot-stop-save.py"

# Validate Python availability
if ! command -v python3 >/dev/null 2>&1; then
  echo "WARNING: python3 not found in PATH. Session capture requires Python 3."
fi

# Validate nmem availability
if command -v nmem >/dev/null 2>&1; then
  echo "✓ nmem found: $(command -v nmem)"
elif command -v nmem.cmd >/dev/null 2>&1; then
  echo "✓ nmem.cmd found: $(command -v nmem.cmd)"
else
  echo "WARNING: nmem not found in PATH. Install with: pip install nmem-cli"
fi

echo "✓ Hooks installed to ${HOOK_DIR}"
echo ""
echo "The Stop hook is configured in hooks/hooks.json to run:"
echo "  python3 ${HOOK_DIR}/copilot-stop-save.py"
echo ""
echo "Session capture is now active. Restart Copilot CLI to apply."
