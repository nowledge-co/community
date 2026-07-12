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

# --- Platform-aware HERMES_HOME default ---
# Hermes stores its home under a platform-native path:
#   - Linux / macOS: ~/.hermes
#   - Windows:       %LOCALAPPDATA%\hermes  (e.g. C:\Users\<you>\AppData\Local\hermes)
# Mirror Hermes' own `_get_platform_default_hermes_home()` so the installer
# lands in the same directory Hermes actually reads, even when the user runs
# this script from git-bash / MSYS without HERMES_HOME exported.
default_hermes_home() {
  if [ -n "${HERMES_HOME:-}" ]; then
    printf '%s' "$HERMES_HOME"
    return
  fi
  case "$(uname -s 2>/dev/null || echo unknown)" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      # git-bash / MSYS / Cygwin on Windows
      local base="${LOCALAPPDATA:-}"
      if [ -z "$base" ] && [ -n "${USERPROFILE:-}" ]; then
        base="$USERPROFILE/AppData/Local"
      fi
      if [ -n "$base" ]; then
        # Normalize backslashes so downstream `$HERMES_HOME/...` works in bash.
        printf '%s/hermes' "${base//\\//}"
        return
      fi
      ;;
  esac
  printf '%s/.hermes' "$HOME"
}

HERMES_HOME="$(default_hermes_home)"
CONFIG="$HERMES_HOME/config.yaml"
BASE_URL="https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes"

# --- Python launcher detection ---
# Standard python.org Windows installers ship only `python.exe`, not `python3`.
# Fall back through `python3` -> `python` -> the Windows `py -3` launcher so the
# config-rewrite helper runs on every supported platform without forcing the
# user to install an extra shim.
detect_python() {
  if command -v python3 >/dev/null 2>&1; then
    printf 'python3'
    return
  fi
  if command -v python >/dev/null 2>&1; then
    # Confirm it is Python 3, not a stray Python 2.
    if python -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
      printf 'python'
      return
    fi
  fi
  if command -v py >/dev/null 2>&1; then
    if py -3 -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
      printf 'py -3'
      return
    fi
  fi
  printf ''
}

# Resolved lazily in plugin mode only — MCP-only installs never touch Python.
PYTHON_BIN=""

echo "[*] Hermes home: $HERMES_HOME"

# --- Soft preflight: nmem CLI reachability ---
# On Windows the desktop app installs the CLI as `nmem.cmd` under
# %LOCALAPPDATA%\Nowledge Mem\cli\, which is added to the user PATH but does
# not always propagate into the current shell (especially git-bash spawned
# before the install). Warn but do not fail — Hermes itself uses
# `shutil.which("nmem")`, which honors PATHEXT and finds the .cmd shim.
if ! command -v nmem >/dev/null 2>&1; then
  echo "[warn] 'nmem' is not visible in this shell."
  echo "       Hermes will still find it via Python's shutil.which (PATHEXT-aware on Windows),"
  echo "       but you may want to add the CLI directory to PATH for manual use."
  case "$(uname -s 2>/dev/null || echo unknown)" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      echo "       Typical Windows location: %LOCALAPPDATA%\\Nowledge Mem\\cli\\nmem.cmd"
      ;;
    Darwin*) echo "       macOS: install via the desktop app, or 'pip install nmem-cli'." ;;
    Linux*)  echo "       Linux: 'pip install nmem-cli' (or 'yay -S nmem-cli' on Arch)." ;;
  esac
fi

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

publish_plugin_files() {
  local source_dir="$1"
  local target_dir="$2"
  local output_prefix="${3:-}"

  mkdir -p "$target_dir"
  for f in $PLUGIN_FILES; do
    cp "$source_dir/$f" "$target_dir/$f"
    echo "  [ok] ${output_prefix}$f"
  done
}

validate_plugin_files() {
  local target_dir="$1"
  $PYTHON_BIN - "$target_dir" <<'PY'
import ast
from pathlib import Path
import sys

target = Path(sys.argv[1])
python_files = sorted(target.glob("*.py"))
if not python_files:
    raise SystemExit("installed plugin contains no Python modules")

missing = []
for path in python_files:
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(path))
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or node.level < 1 or not node.module:
            continue
        module = node.module.split(".", 1)[0]
        if not (target / f"{module}.py").is_file() and not (target / module / "__init__.py").is_file():
            missing.append(f"{path.name}: .{node.module}")

if missing:
    raise SystemExit("missing installed plugin modules: " + ", ".join(sorted(set(missing))))

for path in python_files:
    compile(path.read_text(encoding="utf-8"), str(path), "exec")
PY
}

plugin_version_for_dir() {
  local target_dir="$1"
  if [ ! -f "$target_dir/plugin.yaml" ]; then
    printf 'unknown'
    return
  fi
  sed -n "s/^version:[[:space:]]*//p" "$target_dir/plugin.yaml" | head -n 1 | tr -d "\"'"
}

thread_endpoint_for_dir() {
  local target_dir="$1"
  if grep -qF '"/threads/import"' "$target_dir/client.py" 2>/dev/null; then
    printf '/threads/import'
    return
  fi
  if grep -qF '"/threads"' "$target_dir/client.py" 2>/dev/null; then
    printf '/threads'
    return
  fi
  printf 'unknown'
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
  $PYTHON_BIN - "$config_path" <<'PY'
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
  # Plugin mode rewrites config.yaml via a Python helper (ensure_memory_provider),
  # so Python 3 is required here. MCP-only installs skip this entirely.
  PYTHON_BIN="$(detect_python)"
  if [ -z "$PYTHON_BIN" ]; then
    echo "[error] Python 3 not found on PATH (tried python3, python, py -3)."
    echo "        Install Python 3 from https://www.python.org/ or your package manager and retry."
    exit 1
  fi

  PLUGIN_DIR="$HERMES_HOME/plugins/nowledge-mem"

  # Detect old incorrect path (v0.5.0 installed to plugins/memory/nowledge-mem)
  OLD_PLUGIN_DIR="$HERMES_HOME/plugins/memory/nowledge-mem"
  MIGRATE_OLD=false
  if [ -d "$OLD_PLUGIN_DIR" ] && [ -f "$OLD_PLUGIN_DIR/plugin.yaml" ]; then
    echo "[*] Found old install path; will remove after successful install..."
    MIGRATE_OLD=true
  fi

  echo "[*] Installing Nowledge Mem memory provider plugin..."

  PLUGIN_FILES="plugin.yaml __init__.py provider.py client.py skill_outcome.py"
  ALL_OK=true
  PLUGIN_STAGE="$(mktemp -d "${TMPDIR:-/tmp}/nowledge-mem-hermes.XXXXXX")"
  trap 'rm -rf "$PLUGIN_STAGE"' EXIT
  install_plugin_files "$PLUGIN_STAGE" "download:"

  if ! $ALL_OK; then
    echo "[error] Some files failed to download. Your existing plugin was not changed."
    exit 1
  fi
  if ! validate_plugin_files "$PLUGIN_STAGE"; then
    echo "[error] Downloaded plugin files are incomplete or invalid. Your existing plugin was not changed."
    exit 1
  fi
  echo "  [ok] Downloaded plugin module closure validated"

  LEGACY_MEMORY_PROVIDER_DIR="$HERMES_HOME/hermes-agent/plugins/memory"
  LEGACY_PLUGIN_DIR="$LEGACY_MEMORY_PROVIDER_DIR/nowledge-mem"
  LEGACY_COMPAT_INSTALLED=false
  if needs_legacy_memory_provider_copy "$LEGACY_MEMORY_PROVIDER_DIR"; then
    echo "[*] Detected older Hermes provider discovery; installing compatibility copy..."
    LEGACY_COMPAT_INSTALLED=true
  fi

  publish_plugin_files "$PLUGIN_STAGE" "$PLUGIN_DIR"
  echo "  [ok] Plugin module closure validated"
  if $LEGACY_COMPAT_INSTALLED; then
    publish_plugin_files "$PLUGIN_STAGE" "$LEGACY_PLUGIN_DIR" "legacy:"
    echo "  [ok] Legacy plugin module closure validated"
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
  echo "Installed version: $(plugin_version_for_dir "$PLUGIN_DIR")"
  echo "Thread import endpoint: $(thread_endpoint_for_dir "$PLUGIN_DIR")"
  if $LEGACY_COMPAT_INSTALLED; then
    echo "Compatibility copy installed to $LEGACY_PLUGIN_DIR"
    echo "Compatibility copy version: $(plugin_version_for_dir "$LEGACY_PLUGIN_DIR")"
    echo "Compatibility copy thread import endpoint: $(thread_endpoint_for_dir "$LEGACY_PLUGIN_DIR")"
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
