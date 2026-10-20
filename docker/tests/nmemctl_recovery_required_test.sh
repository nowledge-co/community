#!/usr/bin/env bash
# A server whose automatic graph recovery is exhausted stays up and serves
# /livez, but /health reports `recovery_required`
# (https://github.com/nowledge-co/mem/issues/6163). nmemctl must not report
# such a server as simply ready.
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
  local workdir="$TEST_ROOT/$1" health="$2"
  mkdir -p "$workdir/bin" "$workdir/data" "$workdir/config" "$workdir/cache"
  cp "$DOCKER_DIR/nmemctl" "$DOCKER_DIR/compose.yaml" "$workdir/"
  chmod +x "$workdir/nmemctl"
  printf '%s\n' "$health" > "$workdir/health.json"
  cat > "$workdir/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${NMEM_FAKE_DOCKER_LOG:?}"
if [[ "${1:-}" == "compose" ]]; then
  shift
  [[ "${1:-}" == "version" ]] && { printf 'Docker Compose version v2.99.0\n'; exit 0; }
  while [[ "${1:-}" == "-f" ]]; do shift 2; done
  [[ "${1:-}" == "ps" && "${2:-}" == "-q" ]] && printf 'fake-mem-container\n'
  if [[ "${1:-}" == "exec" ]]; then
    case "$*" in
      *"/health/details"*) printf '{"status":"recovery_required"}\n' ;;
      *"/health"*) cat "${NMEM_FAKE_HEALTH:?}" ;;
    esac
  fi
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
  (cd "$workdir" && PATH="$workdir/bin:$PATH" NMEM_FAKE_DOCKER_LOG="$workdir/docker.log" \
    NMEM_FAKE_HEALTH="$workdir/health.json" ./nmemctl "$@") 2>&1 || true
}

test_status_reports_a_parked_server() {
  local workdir output
  workdir="$(make_fixture parked '{"status":"recovery_required","reason":"failed_attempt_retained"}')"
  output="$(run_nmemctl "$workdir" status)"
  printf '%s\n' "$output" | grep -Fq "needs recovery (reason: failed_attempt_retained)" \
    || { printf '%s\n' "$output" >&2; fail "status must report the recovery-required reason"; }
}

test_restart_reports_a_parked_server() {
  local workdir output
  workdir="$(make_fixture restart '{"status":"recovery_required","reason":"insufficient_space"}')"
  output="$(run_nmemctl "$workdir" restart)"
  printf '%s\n' "$output" | grep -Fq "needs recovery (reason: insufficient_space)" \
    || { printf '%s\n' "$output" >&2; fail "restart must report the recovery-required reason"; }
}

test_healthy_server_has_no_warning() {
  local workdir output
  workdir="$(make_fixture healthy '{"status":"ok"}')"
  output="$(run_nmemctl "$workdir" status)"
  if printf '%s\n' "$output" | grep -Fq "needs recovery"; then
    printf '%s\n' "$output" >&2
    fail "a healthy server must not be reported as needing recovery"
  fi
}

test_status_reports_a_parked_server
test_restart_reports_a_parked_server
test_healthy_server_has_no_warning

printf 'nmemctl recovery-required tests passed\n'
