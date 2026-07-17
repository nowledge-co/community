#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP_SH="$ROOT_DIR/setup.sh"
EXPECTED_VERSION="$(sed -n "s/^version:[[:space:]]*//p" "$ROOT_DIR/plugin.yaml" | head -n 1 | tr -d "\"'")"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  echo "[fail] $1" >&2
  exit 1
}

run_with_config() {
  local fixture_name="$1"
  local fixture_content="$2"
  local expected_line="$3"
  local expected_output="$4"

  local home_dir="$TMP_DIR/$fixture_name-home"
  local hermes_home="$home_dir/.hermes"
  mkdir -p "$hermes_home"
  printf '%s\n' "$fixture_content" > "$hermes_home/config.yaml"

  local output
  if ! output="$(HOME="$home_dir" HERMES_HOME="$hermes_home" bash "$SETUP_SH" 2>&1)"; then
    echo "$output" >&2
    fail "$fixture_name exited non-zero"
  fi

  grep -Fq "$expected_line" "$hermes_home/config.yaml" || fail "$fixture_name did not update config.yaml"
  grep -Fq "$expected_output" <<<"$output" || fail "$fixture_name did not report expected installer output"
  [ -f "$hermes_home/plugins/nowledge-mem/plugin.yaml" ] || fail "$fixture_name did not install plugin files"
  [ -f "$hermes_home/plugins/nowledge-mem/skill_outcome.py" ] || fail "$fixture_name omitted skill_outcome.py"
  grep -Fq 'Plugin module closure validated' <<<"$output" || fail "$fixture_name did not validate plugin module closure"
  grep -Fq "Installed version: $EXPECTED_VERSION" <<<"$output" || fail "$fixture_name did not report installed version"
  grep -Fq 'Thread import endpoint: /threads/import' <<<"$output" || fail "$fixture_name did not report thread import endpoint"
}

run_with_config \
  "empty-provider" \
  $'memory:\n  provider: ""' \
  'provider: "nowledge-mem"' \
  '[ok] Filled empty memory.provider'

run_with_config \
  "missing-provider" \
  $'memory:\n  timeout: 30' \
  'provider: "nowledge-mem"' \
  '[ok] Added memory.provider under existing memory: block'

conflict_home="$TMP_DIR/conflict-home"
conflict_hermes="$conflict_home/.hermes"
mkdir -p "$conflict_hermes"
cat > "$conflict_hermes/config.yaml" <<'YAML'
memory:
  provider: "other-provider"
YAML

set +e
conflict_output="$(HOME="$conflict_home" HERMES_HOME="$conflict_hermes" bash "$SETUP_SH" 2>&1)"
conflict_status=$?
set -e

[ "$conflict_status" -ne 0 ] || fail "conflict-provider unexpectedly succeeded"
grep -Fq '[action needed]' <<<"$conflict_output" || fail "conflict-provider did not explain the conflict"
grep -Fq 'provider: "other-provider"' "$conflict_hermes/config.yaml" || fail "conflict-provider should not rewrite existing provider"

legacy_home="$TMP_DIR/legacy-home"
legacy_hermes="$legacy_home/.hermes"
legacy_memory_dir="$legacy_hermes/hermes-agent/plugins/memory"
mkdir -p "$legacy_memory_dir"
cat > "$legacy_hermes/config.yaml" <<'YAML'
memory:
  provider: ""
YAML
cat > "$legacy_memory_dir/__init__.py" <<'PY'
from pathlib import Path
_MEMORY_PLUGINS_DIR = Path(__file__).parent
PY

legacy_output="$(HOME="$legacy_home" HERMES_HOME="$legacy_hermes" bash "$SETUP_SH" 2>&1)"
grep -Fq '[*] Detected older Hermes provider discovery' <<<"$legacy_output" || fail "legacy runtime was not detected"
[ -f "$legacy_hermes/plugins/nowledge-mem/plugin.yaml" ] || fail "legacy canonical plugin install missing"
[ -f "$legacy_memory_dir/nowledge-mem/plugin.yaml" ] || fail "legacy compatibility plugin install missing"
[ -f "$legacy_memory_dir/nowledge-mem/skill_outcome.py" ] || fail "legacy compatibility plugin omitted skill_outcome.py"
grep -Fq 'Legacy plugin module closure validated' <<<"$legacy_output" || fail "legacy compatibility plugin was not validated"
grep -Fq 'provider: "nowledge-mem"' "$legacy_hermes/config.yaml" || fail "legacy config provider not updated"

# --- Cross-platform default HERMES_HOME ---
# Simulate a Windows shell where HERMES_HOME is unset but LOCALAPPDATA is
# present (git-bash / MSYS / Cygwin behavior). The installer must land under
# %LOCALAPPDATA%\hermes instead of the Linux-only ~/.hermes fallback.
win_home="$TMP_DIR/win-home"
win_localappdata="$win_home/AppData/Local"
win_hermes="$win_localappdata/hermes"
mkdir -p "$win_localappdata"

win_output="$(
  env -u HERMES_HOME \
  HOME="$win_home" \
  USERPROFILE="$win_home" \
  LOCALAPPDATA="$win_localappdata" \
  MSYSTEM="MINGW64" \
  bash -c '
    # Force the Windows branch of the detection regardless of host uname.
    uname() { echo "MINGW64_NT-10.0"; }
    export -f uname
    bash "'"$SETUP_SH"'"
  ' 2>&1
)" || fail "windows-default unexpectedly exited non-zero"

grep -Fq "Hermes home: $win_hermes" <<<"$win_output" \
  || fail "windows-default did not resolve LOCALAPPDATA-based home (got: ${win_output%%$'\n'*})"
[ -f "$win_hermes/plugins/nowledge-mem/plugin.yaml" ] \
  || fail "windows-default did not install plugin under LOCALAPPDATA"
grep -Fq 'provider: "nowledge-mem"' "$win_hermes/config.yaml" \
  || fail "windows-default did not write memory.provider"
# Linux-only fallback must NOT have been used.
[ ! -d "$win_home/.hermes" ] \
  || fail "windows-default incorrectly created ~/.hermes alongside LOCALAPPDATA path"

# --- Reinstall overwrites stale runtime files ---
# Users often ask an agent to diff the installed runtime against community/main.
# A stale client.py used to be indistinguishable from a deliberate local patch.
# Re-running setup must replace the runtime copy and print the endpoint Hermes
# will load after restart.
stale_home="$TMP_DIR/stale-home"
stale_hermes="$stale_home/.hermes"
stale_plugin="$stale_hermes/plugins/nowledge-mem"
mkdir -p "$stale_plugin"
cat > "$stale_hermes/config.yaml" <<'YAML'
memory:
  provider: "nowledge-mem"
YAML
cat > "$stale_plugin/client.py" <<'PY'
def import_thread(self, payload):
    return self._api_post("/threads", payload)
PY

stale_output="$(HOME="$stale_home" HERMES_HOME="$stale_hermes" bash "$SETUP_SH" 2>&1)" \
  || { echo "$stale_output" >&2; fail "stale-runtime reinstall failed"; }
grep -Fq 'Thread import endpoint: /threads/import' <<<"$stale_output" \
  || fail "stale-runtime did not report refreshed import endpoint"
grep -Fq '"/threads/import"' "$stale_plugin/client.py" \
  || fail "stale-runtime client.py was not overwritten"
! grep -Fq '"/threads"' "$stale_plugin/client.py" \
  || fail "stale-runtime left old /threads-only client.py content behind"

# 0.5.20/0.5.21 could leave an otherwise valid provider directory without
# skill_outcome.py. Reinstalling must repair the missing module as well as
# overwrite stale files; manual `nmem t sync` succeeding does not prove Hermes
# can import this provider.
incomplete_home="$TMP_DIR/incomplete-home"
incomplete_hermes="$incomplete_home/.hermes"
incomplete_plugin="$incomplete_hermes/plugins/nowledge-mem"
mkdir -p "$incomplete_plugin"
cat > "$incomplete_hermes/config.yaml" <<'YAML'
memory:
  provider: "nowledge-mem"
YAML
for plugin_file in plugin.yaml __init__.py provider.py client.py; do
  cp "$ROOT_DIR/$plugin_file" "$incomplete_plugin/$plugin_file"
done
[ ! -e "$incomplete_plugin/skill_outcome.py" ] \
  || fail "incomplete-runtime fixture unexpectedly contains skill_outcome.py"

incomplete_output="$(HOME="$incomplete_home" HERMES_HOME="$incomplete_hermes" bash "$SETUP_SH" 2>&1)" \
  || { echo "$incomplete_output" >&2; fail "incomplete-runtime reinstall failed"; }
[ -f "$incomplete_plugin/skill_outcome.py" ] \
  || fail "incomplete-runtime reinstall did not restore skill_outcome.py"
grep -Fq 'Plugin module closure validated' <<<"$incomplete_output" \
  || fail "incomplete-runtime reinstall did not validate the repaired provider"

# --- Explicit HERMES_HOME always wins ---
override_home="$TMP_DIR/override-home"
mkdir -p "$override_home"
HOME="$TMP_DIR/elsewhere" LOCALAPPDATA="$TMP_DIR/win-elsewhere/AppData/Local" \
  HERMES_HOME="$override_home" bash "$SETUP_SH" >/dev/null 2>&1 \
  || fail "explicit HERMES_HOME run failed"
[ -f "$override_home/plugins/nowledge-mem/plugin.yaml" ] \
  || fail "explicit HERMES_HOME was not honored"

# --- MCP-only install must not require Python ---
# Regression for PR #270: a top-level Python 3 preflight made `setup.sh --mcp`
# hard-fail on machines without python3/python/py, even though MCP mode never
# runs the Python config-rewrite helper. Stub the three launchers so
# `command -v` reports them missing, then assert the MCP install still succeeds
# and writes the MCP server block. curl/grep/mkdir keep working (only the
# python launcher lookups are intercepted).
mcp_home="$TMP_DIR/mcp-no-python-home"
mcp_hermes="$mcp_home/.hermes"
mkdir -p "$mcp_hermes"

set +e
mcp_output="$(
  HOME="$mcp_home" HERMES_HOME="$mcp_hermes" \
  bash -c '
    command() {
      if [ "$1" = "-v" ]; then
        case "$2" in
          python3|python|py) return 1 ;;
        esac
      fi
      builtin command "$@"
    }
    export -f command
    bash "'"$SETUP_SH"'" --mcp
  ' 2>&1
)"
mcp_status=$?
set -e

[ "$mcp_status" -eq 0 ] \
  || { echo "$mcp_output" >&2; fail "mcp-no-python exited non-zero without Python"; }
grep -Fq 'http://127.0.0.1:14242/mcp/' "$mcp_hermes/config.yaml" \
  || fail "mcp-no-python did not write MCP server config to config.yaml"
grep -Fq 'nowledge-mem:' "$mcp_hermes/config.yaml" \
  || fail "mcp-no-python did not write nowledge-mem MCP entry"

echo "[ok] Hermes setup installer regression checks passed"
