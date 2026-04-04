#!/usr/bin/env bash
# Nowledge Mem for Hermes Agent — one-command setup
#
# Plugin install (recommended, Hermes v0.7.0+):
#   bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh)
#
# MCP-only install (any Hermes version):
#   bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh) --mcp
#
# Safe to run multiple times (idempotent).

set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
CONFIG="$HERMES_HOME/config.yaml"
BASE_URL="https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes"

# Detect local repo directory (for users who cloned the repo)
SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != /dev/* && "${BASH_SOURCE[0]}" != /proc/* ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || SCRIPT_DIR=""
fi

# --- Mode selection ---
MODE="plugin"
for arg in "$@"; do
  case "$arg" in
    --mcp) MODE="mcp" ;;
    --plugin) MODE="plugin" ;;
  esac
done

mkdir -p "$HERMES_HOME"

# --- Helper: download or read local file ---
get_file() {
  local filename="$1"
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/$filename" ]; then
    cat "$SCRIPT_DIR/$filename"
  else
    curl -sfL "$BASE_URL/$filename" || true
  fi
}

# =========================================================================
# Plugin install
# =========================================================================
if [ "$MODE" = "plugin" ]; then
  PLUGIN_DIR="$HERMES_HOME/plugins/memory/nowledge-mem"
  mkdir -p "$PLUGIN_DIR"

  echo "[*] Installing Nowledge Mem memory provider plugin..."

  PLUGIN_FILES="plugin.yaml __init__.py provider.py client.py"
  ALL_OK=true

  for f in $PLUGIN_FILES; do
    CONTENT="$(get_file "$f")"
    if [ -z "$CONTENT" ]; then
      echo "[error] Could not download $f"
      ALL_OK=false
      continue
    fi
    printf '%s\n' "$CONTENT" > "$PLUGIN_DIR/$f"
    echo "  [ok] $f"
  done

  if ! $ALL_OK; then
    echo "[error] Some files failed to download. Check your network."
    exit 1
  fi

  # Set memory.provider in config.yaml
  if [ -f "$CONFIG" ] && grep -qF "provider:" "$CONFIG" && grep -qF "nowledge-mem" "$CONFIG"; then
    echo "[ok] memory.provider already set in $CONFIG"
  elif [ ! -f "$CONFIG" ]; then
    cat > "$CONFIG" << 'YAML'
memory:
  provider: "nowledge-mem"
YAML
    echo "[ok] Created $CONFIG with memory.provider: nowledge-mem"
  elif grep -qF "memory:" "$CONFIG"; then
    # memory section exists but provider not set — inform user
    echo ""
    echo "[action needed] $CONFIG has a memory: section but provider is not set."
    echo "Add the following under your memory: block:"
    echo ""
    echo '  provider: "nowledge-mem"'
    echo ""
  else
    # No memory section — append it
    printf '\nmemory:\n  provider: "nowledge-mem"\n' >> "$CONFIG"
    echo "[ok] Added memory.provider to $CONFIG"
  fi

  # Remove MCP server config if present (plugin replaces it)
  if [ -f "$CONFIG" ] && grep -qF "nowledge-mem:" "$CONFIG" && grep -qF "url:" "$CONFIG" && grep -qF "/mcp" "$CONFIG"; then
    echo "[note] You can remove the nowledge-mem entry from mcp_servers: in $CONFIG"
    echo "       The plugin connects directly; MCP server config is no longer needed."
  fi

  echo ""
  echo "Plugin installed to $PLUGIN_DIR"
  echo "Restart Hermes, then test:"
  echo '  "Search my memories for recent decisions"'
  exit 0
fi

# =========================================================================
# MCP-only install
# =========================================================================

SOUL_MD="$HERMES_HOME/SOUL.md"
MARKER="# Nowledge Mem for Hermes"
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

if [ -f "$SOUL_MD" ] && grep -qF "$MARKER" "$SOUL_MD"; then
  echo "[ok] Behavioral guidance already in $SOUL_MD"
  GUIDANCE_OK=true
else
  GUIDANCE="$(get_file "AGENTS.md")"

  if [ -z "$GUIDANCE" ]; then
    echo "[error] Could not download guidance. Check your network and try again."
    exit 1
  fi

  if ! printf '%s' "$GUIDANCE" | grep -qF "$MARKER"; then
    echo "[error] Downloaded content does not look like Nowledge Mem guidance."
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
