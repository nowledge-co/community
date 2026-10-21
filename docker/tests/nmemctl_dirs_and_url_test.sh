#!/usr/bin/env bash
# Two findings from the real-Docker verification of
# https://github.com/nowledge-co/mem/pull/7806:
# - restored ./data already owned by the image user, but a new ./config: the
#   ownership fix must still run, or the server cannot write its config;
# - a remapped host port: the printed web URL must use the published port.
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
  local workdir="$TEST_ROOT/$1" published="$2"
  mkdir -p "$workdir/bin" "$workdir/data" "$workdir/config" "$workdir/cache"
  cp "$DOCKER_DIR/nmemctl" "$DOCKER_DIR/compose.yaml" "$workdir/"
  chmod +x "$workdir/nmemctl"
  printf '%s\n' "$published" > "$workdir/published"
  cat > "$workdir/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${NMEM_FAKE_DOCKER_LOG:?}"
if [[ "${1:-}" == "compose" ]]; then
  shift
  [[ "${1:-}" == "version" ]] && { printf 'Docker Compose version v2.99.0\n'; exit 0; }
  while [[ "${1:-}" == "-f" ]]; do shift 2; done
  [[ "${1:-}" == "ps" && "${2:-}" == "-q" ]] && printf 'fake-mem-container\n'
  if [[ "${1:-}" == "port" ]]; then
    published="$(cat "${NMEM_FAKE_PUBLISHED:?}")"
    [[ -n "$published" ]] && printf '%s\n' "$published"
  fi
  if [[ "${1:-}" == "exec" ]]; then
    case "$*" in
      *"/health"*) printf '{"status":"ok"}\n' ;;
    esac
  fi
  exit 0
fi
[[ "${1:-}" == "inspect" ]] && printf 'true\n'
exit 0
FAKE_DOCKER
  chmod +x "$workdir/bin/docker"
  # Fake stat: ./data already belongs to the image user, the rest do not.
  cat > "$workdir/bin/stat" <<'FAKE_STAT'
#!/usr/bin/env bash
case "${@: -1}" in
  */data) printf '10001:10001\n' ;;
  *) printf '501:20\n' ;;
esac
FAKE_STAT
  chmod +x "$workdir/bin/stat"
  printf '%s\n' "$workdir"
}

run_nmemctl() {
  local workdir="$1"
  shift
  (cd "$workdir" && PATH="$workdir/bin:$PATH" NMEM_FAKE_DOCKER_LOG="$workdir/docker.log" \
    NMEM_FAKE_PUBLISHED="$workdir/published" ./nmemctl "$@") 2>&1 || true
}

test_new_config_is_chowned_even_when_data_is_owned() {
  local workdir
  workdir="$(make_fixture chown '0.0.0.0:14242')"
  run_nmemctl "$workdir" up >/dev/null
  grep -Eq 'run --rm .*chown -R 10001:10001' "$workdir/docker.log" || {
    cat "$workdir/docker.log" >&2
    fail "a new ./config must be chowned even when ./data already is"
  }
}

test_url_uses_the_published_port() {
  local workdir output
  workdir="$(make_fixture remapped '0.0.0.0:15142')"
  output="$(run_nmemctl "$workdir" status)"
  printf '%s\n' "$output" | grep -Eq ':15142/app' \
    || { printf '%s\n' "$output" >&2; fail "the URL must use the published port"; }
}

test_url_falls_back_to_the_default_port() {
  local workdir output
  workdir="$(make_fixture unpublished '')"
  output="$(run_nmemctl "$workdir" status)"
  printf '%s\n' "$output" | grep -Eq ':14242/app' \
    || { printf '%s\n' "$output" >&2; fail "without a published port the URL keeps 14242"; }
}

test_new_config_is_chowned_even_when_data_is_owned
test_url_uses_the_published_port
test_url_falls_back_to_the_default_port

printf 'nmemctl dirs and url tests passed\n'
