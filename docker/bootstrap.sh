#!/usr/bin/env bash
#
# bootstrap.sh — first-launch helper for the Nowledge Mem headless image.
#
# Idempotent: safe to run any number of times. On a fresh stack it brings
# everything up, waits for readiness, prints the Access Anywhere API key, and
# (optionally) activates a license. On an already-running stack it just
# re-prints the key and the license status.
#
# Usage:
#   ./bootstrap.sh                                   # bring up + show key
#   ./bootstrap.sh activate <BASE64_LICENSE_CODE>    # also activate license
#   ./bootstrap.sh rotate-key                        # rotate the API key
#
# Designed to be run from the directory containing compose.yaml.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker not found on PATH" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "error: 'docker compose' v2 plugin not installed" >&2
  exit 1
fi
if [[ ! -f compose.yaml ]]; then
  echo "error: compose.yaml not found in $SCRIPT_DIR" >&2
  exit 1
fi

# Compose wrapper. Use the local compose.yaml by default; users overlaying TLS
# can re-export NMEM_COMPOSE_FILES before running:
#   NMEM_COMPOSE_FILES='-f compose.yaml -f compose.tls.yaml' ./bootstrap.sh
NMEM_COMPOSE_FILES="${NMEM_COMPOSE_FILES:--f compose.yaml}"
DC=(docker compose ${NMEM_COMPOSE_FILES})

step() { printf "\n\033[1;34m==>\033[0m %s\n" "$*"; }
note() { printf "    %s\n" "$*"; }
fail() { printf "\033[1;31merror:\033[0m %s\n" "$*" >&2; exit 1; }

# Resolve the service name (defaults to "mem" in our compose, but allow overrides).
SVC="${NMEM_SERVICE:-mem}"

cmd="${1:-up}"

case "$cmd" in
  up|"")
    step "Bringing Nowledge Mem up"
    "${DC[@]}" up -d

    step "Waiting for /livez (up to 120s)"
    for i in $(seq 1 60); do
      if "${DC[@]}" exec -T "$SVC" sh -c \
          'python3 -c "import urllib.request,sys; r=urllib.request.urlopen(\"http://127.0.0.1:14242/livez\", timeout=4); sys.exit(0 if r.status==200 else 1)"' \
          >/dev/null 2>&1; then
        note "ready in $((i*2))s"
        break
      fi
      sleep 2
      if [[ $i -eq 60 ]]; then
        fail "server did not become live in 120s. Check 'docker compose logs $SVC'."
      fi
    done

    step "Access Anywhere API key (paste into the web UI when prompted)"
    KEY="$("${DC[@]}" exec -T "$SVC" nmem key 2>/dev/null | tr -d '\r\n')"
    if [[ -z "$KEY" ]]; then
      fail "could not retrieve API key (\`nmem key\` returned empty)."
    fi
    note "$KEY"
    note "stored at /etc/nowledge-mem/co.nowledge.mem.desktop/remote-access.json (mode 0600)"
    note "rotate with:  $0 rotate-key"

    step "License status"
    "${DC[@]}" exec -T "$SVC" nmem license status || true

    # Resolve an externally reachable URL hint, best-effort.
    if command -v hostname >/dev/null 2>&1; then
      IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    fi
    : "${IP:=localhost}"
    step "Open the web UI"
    note "http://${IP}:14242/app"
    note "(paste the key above when asked for an API key)"
    ;;

  activate)
    code="${2:-}"
    [[ -n "$code" ]] || fail "usage: $0 activate <BASE64_LICENSE_CODE>"
    step "Activating license"
    "${DC[@]}" exec -T "$SVC" nmem license activate "$code"
    step "License status"
    "${DC[@]}" exec -T "$SVC" nmem license status
    ;;

  rotate-key)
    step "Rotating Access Anywhere API key"
    note "Old key will stop working immediately. Web-UI sessions and MCP"
    note "clients must be re-authed with the new value."
    "${DC[@]}" exec -T "$SVC" nmem key --rotate
    step "New key"
    "${DC[@]}" exec -T "$SVC" nmem key
    ;;

  *)
    cat <<EOF >&2
usage:
  $0                            bring up + print key + license status
  $0 activate <BASE64_CODE>     activate a license
  $0 rotate-key                 rotate the Access Anywhere API key
EOF
    exit 2
    ;;
esac
