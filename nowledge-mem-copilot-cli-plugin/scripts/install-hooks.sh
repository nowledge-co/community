#!/usr/bin/env bash
# install-hooks.sh — optional compatibility installer for Copilot CLI session capture hooks.
#
# Current Copilot marketplace installs should execute the capture runtime directly from
# the plugin's hooks/ directory via COPILOT_PLUGIN_ROOT. This script remains as an
# idempotent fallback for older installs or local development flows that still want a
# compatibility copy in ~/.copilot/nowledge-mem-hooks/.
set -euo pipefail

HOOK_DIR="${HOME}/.copilot/nowledge-mem-hooks"
SCRIPT_SOURCE="${BASH_SOURCE[0]:-$0}"
if command -v realpath >/dev/null 2>&1; then
  SCRIPT_PATH="$(realpath "${SCRIPT_SOURCE}")"
elif command -v readlink >/dev/null 2>&1; then
  RESOLVED="$(readlink "${SCRIPT_SOURCE}" 2>/dev/null || true)"
  if [[ -n "${RESOLVED}" ]]; then
    if [[ "${RESOLVED}" = /* ]]; then
      SCRIPT_PATH="${RESOLVED}"
    else
      SCRIPT_PATH="$(cd "$(dirname "${SCRIPT_SOURCE}")" && cd "$(dirname "${RESOLVED}")" && pwd)/$(basename "${RESOLVED}")"
    fi
  else
    SCRIPT_PATH="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)/$(basename "${SCRIPT_SOURCE}")"
  fi
else
  SCRIPT_PATH="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)/$(basename "${SCRIPT_SOURCE}")"
fi

PLUGIN_ROOT="$(cd "$(dirname "${SCRIPT_PATH}")/.." && pwd)"
SOURCE_DIR="${PLUGIN_ROOT}/hooks"

if [[ ! -f "${SOURCE_DIR}/copilot-stop-save.py" || ! -f "${SOURCE_DIR}/copilot-stop-save.sh" ]]; then
  echo "ERROR: Expected hook sources under ${SOURCE_DIR}. Run this script from the plugin's scripts/ directory." >&2
  exit 1
fi

echo "Installing compatibility copy of Nowledge Mem Copilot CLI hooks..."

# Create directories
mkdir -p "${HOOK_DIR}/state"

# Copy scripts
cp -f "${SOURCE_DIR}/copilot-stop-save.py" "${HOOK_DIR}/copilot-stop-save.py"
cp -f "${SOURCE_DIR}/copilot-stop-save.sh" "${HOOK_DIR}/copilot-stop-save.sh"

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

echo "✓ Compatibility hooks installed to ${HOOK_DIR}"
echo ""
echo "Modern marketplace installs should run directly from:"
echo "  ${SOURCE_DIR}/copilot-stop-save.py"
echo ""
echo "This fallback copy remains available at:"
echo "  ${HOOK_DIR}/copilot-stop-save.py"
echo ""
echo "Session capture is now active. Restart Copilot CLI to apply."
