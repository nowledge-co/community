#!/usr/bin/env bash
# Nowledge Mem for Hermes Agent - setup script
# Appends behavioral guidance to ~/HERMES.md (safe to run multiple times)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_MD="$SCRIPT_DIR/AGENTS.md"
TARGET="$HOME/HERMES.md"
MARKER="# Nowledge Mem for Hermes"

if [ ! -f "$AGENTS_MD" ]; then
  echo "Error: $AGENTS_MD not found. Run this script from the nowledge-mem-hermes directory."
  exit 1
fi

# Check if already appended
if [ -f "$TARGET" ] && grep -qF "$MARKER" "$TARGET"; then
  echo "Nowledge Mem guidance is already in $TARGET. No changes made."
  echo ""
  echo "To update, remove the existing Nowledge Mem section from $TARGET and re-run."
  exit 0
fi

# Append with a separator
if [ -f "$TARGET" ]; then
  echo "" >> "$TARGET"
  echo "---" >> "$TARGET"
  echo "" >> "$TARGET"
  cat "$AGENTS_MD" >> "$TARGET"
  echo "Appended Nowledge Mem guidance to $TARGET"
else
  cp "$AGENTS_MD" "$TARGET"
  echo "Created $TARGET with Nowledge Mem guidance"
fi

echo ""
echo "Next steps:"
echo "  1. Add MCP server to ~/.hermes/config.yaml (if not already done):"
echo "     mcp_servers:"
echo "       nowledge-mem:"
echo "         url: \"http://127.0.0.1:14242/mcp\""
echo "         timeout: 120"
echo "  2. Restart Hermes"
echo "  3. Test: ask Hermes to 'search my memories for recent decisions'"
