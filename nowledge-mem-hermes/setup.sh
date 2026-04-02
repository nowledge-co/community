#!/usr/bin/env bash
# Nowledge Mem for Hermes Agent — one-command setup
# Configures MCP server and installs behavioral guidance.
# Safe to run multiple times (idempotent).
#
# Usage (no repo clone needed):
#   bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh)

set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
SOUL_MD="$HERMES_HOME/SOUL.md"
CONFIG="$HERMES_HOME/config.yaml"
MARKER="# Nowledge Mem for Hermes"
AGENTS_URL="https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/AGENTS.md"

mkdir -p "$HERMES_HOME"

# --- Step 1: MCP server config ---

if [ -f "$CONFIG" ] && grep -qF "nowledge-mem" "$CONFIG"; then
  echo "[ok] MCP server already in $CONFIG"
else
  if [ ! -f "$CONFIG" ]; then
    cat > "$CONFIG" << 'YAML'
mcp_servers:
  nowledge-mem:
    url: "http://127.0.0.1:14242/mcp"
    timeout: 120
YAML
    echo "[ok] Created $CONFIG with Nowledge Mem MCP server"
  else
    echo ""
    echo "[action needed] Add the MCP server to $CONFIG:"
    echo ""
    echo "  mcp_servers:"
    echo "    nowledge-mem:"
    echo '      url: "http://127.0.0.1:14242/mcp"'
    echo "      timeout: 120"
    echo ""
  fi
fi

# --- Step 2: Behavioral guidance ---
#
# Hermes loads ~/.hermes/SOUL.md on every session regardless of working
# directory.  HERMES.md is only discovered by walking from the current
# directory to the git root, so ~/HERMES.md is NOT found when working
# inside a git repository.  SOUL.md is the only reliable global path.

if [ -f "$SOUL_MD" ] && grep -qF "$MARKER" "$SOUL_MD"; then
  echo "[ok] Behavioral guidance already in $SOUL_MD"
else
  # Prefer local AGENTS.md (for repo-cloned users); fall back to GitHub
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" 2>/dev/null)" 2>/dev/null && pwd 2>/dev/null)" || SCRIPT_DIR=""
  GUIDANCE=""
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/AGENTS.md" ]; then
    GUIDANCE="$(cat "$SCRIPT_DIR/AGENTS.md")"
  else
    GUIDANCE="$(curl -sfL "$AGENTS_URL")" || true
  fi

  if [ -z "$GUIDANCE" ]; then
    echo "[error] Could not download guidance. Add manually:"
    echo "  curl -sL $AGENTS_URL >> $SOUL_MD"
    exit 1
  fi

  if [ -f "$SOUL_MD" ]; then
    printf '\n\n---\n\n%s\n' "$GUIDANCE" >> "$SOUL_MD"
    echo "[ok] Appended Nowledge Mem guidance to $SOUL_MD"
  else
    echo "$GUIDANCE" > "$SOUL_MD"
    echo "[ok] Created $SOUL_MD with Nowledge Mem guidance"
  fi
fi

echo ""
echo "Restart Hermes, then test:"
echo '  "Search my memories for recent decisions"'
echo ""
echo "If Hermes searches but never saves proactively, verify that"
echo "$SOUL_MD contains the '# Nowledge Mem for Hermes' section."
