#!/usr/bin/env bash
# Every path that stops the Mem container must give the server enough time to
# finish its final graph checkpoint. Docker's 10-second default can SIGKILL the
# server mid-checkpoint (https://github.com/nowledge-co/mem/issues/5720), so the
# reference compose and every nmemctl stop/recreate pass a 60-second grace.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

make_fixture() {
  local workdir="$TEST_ROOT/$1"
  mkdir -p "$workdir/bin" "$workdir/data" "$workdir/config" "$workdir/cache"
  cp "$DOCKER_DIR/nmemctl" "$DOCKER_DIR/compose.yaml" "$workdir/"
  chmod +x "$workdir/nmemctl"
  # Fake docker: the mem service is running and live; every call is logged.
  cat > "$workdir/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${NMEM_FAKE_DOCKER_LOG:?}"
if [[ "${1:-}" == "compose" ]]; then
  shift
  [[ "${1:-}" == "version" ]] && { printf 'Docker Compose version v2.99.0\n'; exit 0; }
  while [[ "${1:-}" == "-f" ]]; do shift 2; done
  [[ "${1:-}" == "ps" && "${2:-}" == "-q" ]] && printf 'fake-mem-container\n'
  exit 0
fi
[[ "${1:-}" == "inspect" ]] && printf 'true\n'
exit 0
FAKE_DOCKER
  chmod +x "$workdir/bin/docker"
  printf '%s\n' "$workdir"
}

run_nmemctl() {
  local workdir="$1"
  shift
  (cd "$workdir" && PATH="$workdir/bin:$PATH" NMEM_FAKE_DOCKER_LOG="$workdir/docker.log" ./nmemctl "$@") >/dev/null 2>&1 || true
}

assert_logged() {
  local workdir="$1" pattern="$2"
  grep -Eq "$pattern" "$workdir/docker.log" || {
    cat "$workdir/docker.log" >&2
    fail "expected a docker call matching: $pattern"
  }
}

assert_not_logged() {
  local workdir="$1" pattern="$2"
  if grep -Eq "$pattern" "$workdir/docker.log"; then
    cat "$workdir/docker.log" >&2
    fail "unexpected docker call matching: $pattern"
  fi
}

test_compose_sets_grace_period() {
  grep -Eq '^    stop_grace_period: 60s$' "$DOCKER_DIR/compose.yaml" \
    || fail "compose.yaml mem service must set stop_grace_period: 60s"
}

test_down_waits_for_checkpoint() {
  local workdir
  workdir="$(make_fixture down)"
  run_nmemctl "$workdir" down
  assert_logged "$workdir" '^compose .*down -t 60$'
  assert_not_logged "$workdir" '^compose .*down$'
}

test_restart_waits_for_checkpoint() {
  local workdir
  workdir="$(make_fixture restart)"
  run_nmemctl "$workdir" restart
  assert_logged "$workdir" '^compose .*restart -t 60 mem$'
}

test_upgrade_recreate_waits_for_checkpoint() {
  local workdir
  workdir="$(make_fixture upgrade)"
  run_nmemctl "$workdir" upgrade 0.10.104
  assert_logged "$workdir" '^compose .*up -d --force-recreate -t 60 mem$'
  assert_not_logged "$workdir" '^compose .*up -d --force-recreate mem$'
}

test_compose_sets_grace_period
test_down_waits_for_checkpoint
test_restart_waits_for_checkpoint
test_upgrade_recreate_waits_for_checkpoint

printf 'nmemctl stop grace tests passed\n'
