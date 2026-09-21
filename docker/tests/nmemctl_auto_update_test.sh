#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local haystack="$1" needle="$2"
  if ! printf '%s\n' "$haystack" | grep -Fq "$needle"; then
    printf '%s\n' "$haystack" >&2
    fail "expected output to contain: $needle"
  fi
}

assert_not_matches() {
  local haystack="$1" pattern="$2"
  if printf '%s\n' "$haystack" | grep -Eq "$pattern"; then
    printf '%s\n' "$haystack" >&2
    fail "expected output not to match: $pattern"
  fi
}

write_fake_docker() {
  local bin_dir="$1"
  mkdir -p "$bin_dir"
  cat > "$bin_dir/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

log_file="${NMEM_FAKE_DOCKER_LOG:?}"
printf '%s\n' "$*" >> "$log_file"

if [[ "${1:-}" == "compose" ]]; then
  shift
  if [[ "${1:-}" == "version" ]]; then
    printf 'Docker Compose version v2.99.0\n'
    exit 0
  fi
  while [[ "${1:-}" == "-f" ]]; do
    shift 2
  done
  case "${1:-}" in
    up|rm)
      exit 0
      ;;
    ps)
      if [[ "${2:-}" == "-q" && "${3:-}" == "updater" ]]; then
        printf 'fake-updater-container\n'
      fi
      exit 0
      ;;
    *)
      exit 0
      ;;
  esac
fi

case "${1:-}" in
  inspect)
    printf 'healthy\n'
    ;;
  exec)
    printf '{"running_image":"docker.io/nowledgelabs/mem:0.10.82","cached_tags":["0.10.82"]}\n'
    ;;
  pull)
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
FAKE_DOCKER
  chmod +x "$bin_dir/docker"
}

make_fixture() {
  local name="$1" workdir
  workdir="$TEST_ROOT/$name"
  mkdir -p "$workdir/bin"
  cp "$DOCKER_DIR/nmemctl" "$workdir/nmemctl"
  cp "$DOCKER_DIR/compose.yaml" "$workdir/compose.yaml"
  cp "$DOCKER_DIR/compose.updater.yaml" "$workdir/compose.updater.yaml"
  chmod +x "$workdir/nmemctl"
  write_fake_docker "$workdir/bin"
  printf '%s\n' "$workdir"
}

run_nmemctl() {
  local workdir="$1"
  shift
  (
    cd "$workdir"
    PATH="$workdir/bin:$PATH" \
      NMEM_FAKE_DOCKER_LOG="$workdir/docker.log" \
      ./nmemctl "$@"
  )
}

test_enable_repairs_missing_token() {
  local workdir output
  workdir="$(make_fixture token-repair)"
  printf 'NMEM_STATE_OVERLAYS="-f compose.updater.yaml"\n' > "$workdir/.nmemctl-state"
  printf 'NMEM_UPDATER_TAG=0.9.4\n' > "$workdir/.env"
  chmod 0600 "$workdir/.env"

  output="$(run_nmemctl "$workdir" auto-update enable 2>&1)"

  assert_contains "$output" "Repairing auto-update token"
  assert_contains "$output" "new token and remote install opt-in written to .env"
  grep -Eq '^NOWLEDGE_UPDATER_TOKEN=.+$' "$workdir/.env" \
    || fail "expected NOWLEDGE_UPDATER_TOKEN to be repaired"
  grep -Fxq 'NOWLEDGE_ADMIN_REMOTE_OPS=1' "$workdir/.env" \
    || fail "expected NOWLEDGE_ADMIN_REMOTE_OPS=1 to be written"
}

test_status_prints_portable_mode() {
  local workdir output
  workdir="$(make_fixture status-mode)"
  printf 'NMEM_STATE_OVERLAYS="-f compose.updater.yaml"\n' > "$workdir/.nmemctl-state"
  printf 'NOWLEDGE_UPDATER_TOKEN=test-token\n' > "$workdir/.env"
  chmod 0600 "$workdir/.env"

  output="$(run_nmemctl "$workdir" auto-update status 2>&1)"

  assert_contains "$output" "token: present in .env (mode 600)"
  assert_not_matches "$output" 'File:|Type:'
}

test_enable_repairs_missing_token
test_status_prints_portable_mode

printf 'nmemctl auto-update tests passed\n'
