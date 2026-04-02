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

MCP_OK=false
GUIDANCE_OK=false

# --- Step 1: MCP server config ---

if [ -f "$CONFIG" ] && grep -qF "nowledge-mem" "$CONFIG"; then
  echo "[ok] MCP server already in $CONFIG"
  MCP_OK=true
elif [ ! -f "$CONFIG" ]; then
  cat > "$CONFIG" << 'YAML'
mcp_servers:
  nowledge-mem:
    url: "http://127.0.0.1:14242/mcp"
    timeout: 120
YAML
  echo "[ok] Created $CONFIG with Nowledge Mem MCP server"
  MCP_OK=true
else
  echo ""
  echo "[action needed] $CONFIG exists but does not contain nowledge-mem."
  echo "Add the following under your existing mcp_servers: block:"
  echo ""
  echo "    nowledge-mem:"
  echo '      url: "http://127.0.0.1:14242/mcp"'
  echo "      timeout: 120"
  echo ""
fi

# --- Step 2: Behavioral guidance ---
#
# Hermes loads ~/.hermes/SOUL.md on every session regardless of working
# directory.  HERMES.md is only discovered by walking from the current
# directory to the git root, so ~/HERMES.md is NOT found when working
# inside a git repository.  SOUL.md is the only reliable global path.

if [ -f "$SOUL_MD" ] && grep -qF "$MARKER" "$SOUL_MD"; then
  echo "[ok] Behavioral guidance already in $SOUL_MD"
  GUIDANCE_OK=true
else
  # Prefer local AGENTS.md (for repo-cloned users); fall back to GitHub
  SCRIPT_DIR=""
  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != /dev/* && "${BASH_SOURCE[0]}" != /proc/* ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || SCRIPT_DIR=""
  fi

  GUIDANCE=""
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/AGENTS.md" ]; then
    GUIDANCE="$(cat "$SCRIPT_DIR/AGENTS.md")"
  else
    GUIDANCE="$(curl -sfL "$AGENTS_URL")" || true
  fi

  if [ -z "$GUIDANCE" ]; then
    echo "[error] Could not download guidance. Check your network and try again."
    echo "  Manual alternative: curl -sL $AGENTS_URL >> $SOUL_MD"
    exit 1
  fi

  # Validate that we got the expected content, not an error page
  if ! printf '%s' "$GUIDANCE" | grep -qF "$MARKER"; then
    echo "[error] Downloaded content does not look like Nowledge Mem guidance."
    echo "  Manual alternative: curl -sL $AGENTS_URL >> $SOUL_MD"
    exit 1
  fi

  if [ -f "$SOUL_MD" ]; then
    printf '\n\n---\n\n%s\n' "$GUIDANCE" >> "$SOUL_MD"
    echo "[ok] Appended Nowledge Mem guidance to $SOUL_MD"
  else
    printf '%s\n' "$GUIDANCE" > "$SOUL_MD"
    echo "[ok] Created $SOUL_MD with Nowledge Mem guidance"
  fi
  GUIDANCE_OK=true
fi

# --- Summary ---

echo ""
if $MCP_OK && $GUIDANCE_OK; then
  echo "Setup complete. Restart Hermes, then test:"
  echo '  "Search my memories for recent decisions"'
elif $GUIDANCE_OK; then
  echo "Behavioral guidance is ready, but MCP config needs manual setup (see above)."
  echo "After adding the config, restart Hermes."
else
  echo "Setup incomplete. See errors above."
fi
