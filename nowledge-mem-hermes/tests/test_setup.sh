#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP_SH="$ROOT_DIR/setup.sh"
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
grep -Fq 'provider: "nowledge-mem"' "$legacy_hermes/config.yaml" || fail "legacy config provider not updated"

echo "[ok] Hermes setup installer regression checks passed"
