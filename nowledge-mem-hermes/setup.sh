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

install_plugin_files() {
  local target_dir="$1"
  local output_prefix="${2:-}"

  mkdir -p "$target_dir"
  for f in $PLUGIN_FILES; do
    CONTENT="$(get_file "$f")"
    if [ -z "$CONTENT" ]; then
      echo "[error] Could not download $f"
      ALL_OK=false
      continue
    fi
    printf '%s\n' "$CONTENT" > "$target_dir/$f"
    echo "  [ok] ${output_prefix}$f"
  done
}

needs_legacy_memory_provider_copy() {
  local memory_dir="$1"
  local discovery_file="$memory_dir/__init__.py"

  [ -d "$memory_dir" ] || return 1
  [ -f "$discovery_file" ] || return 1

  # New Hermes releases also scan $HERMES_HOME/plugins/<name>. Older releases
  # only scan the bundled plugins/memory directory, so they need a provider copy.
  if grep -qF '_get_user_plugins_dir' "$discovery_file" || grep -qF 'HERMES_HOME/plugins' "$discovery_file"; then
    return 1
  fi

  return 0
}

ensure_memory_provider() {
  local config_path="$1"
  python3 - "$config_path" <<'PY'
from pathlib import Path
import re
import sys

config_path = Path(sys.argv[1])
if not config_path.exists():
    print("missing-file")
    raise SystemExit(0)

text = config_path.read_text(encoding="utf-8")
lines = text.splitlines()

memory_idx = None
for idx, line in enumerate(lines):
    if re.match(r"^memory:\s*(#.*)?$", line):
        memory_idx = idx
        break

if memory_idx is None:
    print("missing-memory")
    raise SystemExit(0)

block_end = len(lines)
for idx in range(memory_idx + 1, len(lines)):
    line = lines[idx]
    stripped = line.strip()
    if not stripped:
        continue
    if line.lstrip().startswith("#"):
        continue
    if not line.startswith((" ", "\t")):
        block_end = idx
        break

child_indent = "  "
for idx in range(memory_idx + 1, block_end):
    line = lines[idx]
    stripped = line.strip()
    if not stripped or line.lstrip().startswith("#"):
        continue
    match = re.match(r"^(\s+)", line)
    if match:
        child_indent = match.group(1)
        break

for idx in range(memory_idx + 1, block_end):
    line = lines[idx]
    match = re.match(r"^(\s*)provider:\s*(.*?)\s*(#.*)?$", line)
    if not match:
        continue
    indent = match.group(1) or child_indent
    raw_value = (match.group(2) or "").strip()
    if raw_value in ('"nowledge-mem"', "'nowledge-mem'", "nowledge-mem"):
        print("already")
        raise SystemExit(0)
    if raw_value in ("", '""', "''"):
        lines[idx] = f'{indent}provider: "nowledge-mem"'
        trailing_newline = "\n" if text.endswith("\n") else ""
        config_path.write_text("\n".join(lines) + trailing_newline, encoding="utf-8")
        print("updated-empty")
        raise SystemExit(0)
    print(f"conflict:{raw_value}")
    raise SystemExit(0)

lines.insert(memory_idx + 1, f'{child_indent}provider: "nowledge-mem"')
trailing_newline = "\n" if text.endswith("\n") else ""
config_path.write_text("\n".join(lines) + trailing_newline, encoding="utf-8")
print("inserted")
PY
}

# =========================================================================
# Plugin install
# =========================================================================
if [ "$MODE" = "plugin" ]; then
  PLUGIN_DIR="$HERMES_HOME/plugins/nowledge-mem"

  # Detect old incorrect path (v0.5.0 installed to plugins/memory/nowledge-mem)
  OLD_PLUGIN_DIR="$HERMES_HOME/plugins/memory/nowledge-mem"
  MIGRATE_OLD=false
  if [ -d "$OLD_PLUGIN_DIR" ] && [ -f "$OLD_PLUGIN_DIR/plugin.yaml" ]; then
    echo "[*] Found old install path; will remove after successful install..."
    MIGRATE_OLD=true
  fi

  mkdir -p "$PLUGIN_DIR"

  echo "[*] Installing Nowledge Mem memory provider plugin..."

  PLUGIN_FILES="plugin.yaml __init__.py provider.py client.py"
  ALL_OK=true

  install_plugin_files "$PLUGIN_DIR"

  LEGACY_MEMORY_PROVIDER_DIR="$HERMES_HOME/hermes-agent/plugins/memory"
  LEGACY_PLUGIN_DIR="$LEGACY_MEMORY_PROVIDER_DIR/nowledge-mem"
  LEGACY_COMPAT_INSTALLED=false
  if needs_legacy_memory_provider_copy "$LEGACY_MEMORY_PROVIDER_DIR"; then
    echo "[*] Detected older Hermes provider discovery; installing compatibility copy..."
    install_plugin_files "$LEGACY_PLUGIN_DIR" "legacy:"
    LEGACY_COMPAT_INSTALLED=true
  fi

  if ! $ALL_OK; then
    echo "[error] Some files failed to download. Check your network."
    exit 1
  fi

  # Now safe to remove old install path (download succeeded)
  if $MIGRATE_OLD; then
    rm -rf "$OLD_PLUGIN_DIR"
    rmdir "$HERMES_HOME/plugins/memory" 2>/dev/null || true
    echo "  [ok] Removed old install path $OLD_PLUGIN_DIR"
  fi

  # Set memory.provider in config.yaml.
  if [ ! -f "$CONFIG" ]; then
    cat > "$CONFIG" << 'YAML'
memory:
  provider: "nowledge-mem"
YAML
    echo "[ok] Created $CONFIG with memory.provider: nowledge-mem"
  else
    MEMORY_PROVIDER_STATUS="$(ensure_memory_provider "$CONFIG")"
    case "$MEMORY_PROVIDER_STATUS" in
      already)
        echo "[ok] memory.provider already set in $CONFIG"
        ;;
      updated-empty)
        echo "[ok] Filled empty memory.provider in $CONFIG"
        ;;
      inserted)
        echo "[ok] Added memory.provider under existing memory: block in $CONFIG"
        ;;
      missing-memory)
        printf '\nmemory:\n  provider: "nowledge-mem"\n' >> "$CONFIG"
        echo "[ok] Added memory.provider to $CONFIG"
        ;;
      conflict:*)
        EXISTING_PROVIDER="${MEMORY_PROVIDER_STATUS#conflict:}"
        echo ""
        echo "[action needed] $CONFIG already sets memory.provider to $EXISTING_PROVIDER."
        echo "If you want Hermes to use this plugin, change it to:"
        echo ""
        echo '  provider: "nowledge-mem"'
        echo ""
        echo "Plugin installed to $PLUGIN_DIR but config still points at another provider."
        exit 1
        ;;
      *)
        echo "[error] Could not update memory.provider in $CONFIG"
        exit 1
        ;;
    esac
  fi

  # Remove MCP server config if present (plugin replaces it)
  if [ -f "$CONFIG" ] && grep -qF "nowledge-mem:" "$CONFIG" && grep -qF "url:" "$CONFIG" && grep -qF "/mcp" "$CONFIG"; then
    echo "[note] You can remove the nowledge-mem entry from mcp_servers: in $CONFIG"
    echo "       The plugin connects directly; MCP server config is no longer needed."
  fi

  echo ""
  echo "Plugin installed to $PLUGIN_DIR"
  if $LEGACY_COMPAT_INSTALLED; then
    echo "Compatibility copy installed to $LEGACY_PLUGIN_DIR"
  fi
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
    url: "http://127.0.0.1:14242/mcp/"
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
  echo '      url: "http://127.0.0.1:14242/mcp/"'
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
