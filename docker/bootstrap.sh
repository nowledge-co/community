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

# Bring the stack up and block until /livez answers. Idempotent: a no-op if the
# service is already running and ready. Used both by the default "up" command
# and as a prerequisite for "activate" so license activation does not race
# against a fresh `docker compose down`.
bring_up_and_wait() {
  step "Bringing Nowledge Mem up"
  "${DC[@]}" up -d

  step "Waiting for /livez (up to 120s)"
  # `i` is 1-indexed and the first probe runs before any sleep, so elapsed
  # seconds is `(i-1)*2`, not `i*2`. Was off by 2s on the first probe.
  for i in $(seq 1 60); do
    if "${DC[@]}" exec -T "$SVC" \
        /opt/nowledge-mem/python/bin/python3 -c \
          'import urllib.request,sys; sys.exit(0 if urllib.request.urlopen("http://127.0.0.1:14242/livez", timeout=4).status==200 else 1)' \
        >/dev/null 2>&1; then
      note "ready in $(( (i - 1) * 2 ))s"
      return 0
    fi
    sleep 2
    if [[ $i -eq 60 ]]; then
      fail "server did not become live in 120s. Check '${DC[*]} logs $SVC'."
    fi
  done
}

# Read the effective NOWLEDGE_DOMAIN that Compose will inject — works whether
# the operator exported it to the shell or put it in a `.env` next to
# compose.yaml for Compose interpolation. Returns empty if neither path
# defines it.
resolve_tls_domain() {
  local val
  val="$("${DC[@]}" config 2>/dev/null \
        | awk '$1=="NOWLEDGE_DOMAIN:"{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2; exit}')" || val=""
  printf '%s\n' "${val%\"}" | sed 's/^"//; s/"$//'
}

cmd="${1:-up}"

case "$cmd" in
  up|"")
    bring_up_and_wait

    step "Access Anywhere API key (paste into the web UI when prompted)"
    # `|| KEY=""` so a failing `nmem key` lets the friendly check below
    # surface the diagnostic instead of `set -e` silently aborting the
    # script in the middle of a command-substitution pipeline.
    KEY="$("${DC[@]}" exec -T "$SVC" nmem key 2>/dev/null | tr -d '\r\n')" || KEY=""
    if [[ -z "$KEY" ]]; then
      fail "could not retrieve API key (\`nmem key\` returned empty)."
    fi
    note "$KEY"
    note "stored at /etc/nowledge-mem/co.nowledge.mem.desktop/remote-access.json (mode 0600)"
    note "rotate with:  $0 rotate-key"

    step "License status"
    "${DC[@]}" exec -T "$SVC" nmem license status || true

    step "Open the web UI"
    # If the TLS overlay is active, mem is bound to loopback and traffic
    # is supposed to flow through Caddy on 443. Print the HTTPS URL so
    # operators don't chase a non-routable HTTP endpoint. Ask Compose
    # for the *merged* NOWLEDGE_DOMAIN so an operator who keeps it in
    # `.env` (for Compose interpolation, not shell export) is handled
    # the same as one who `export`s it.
    TLS_DOMAIN=""
    if [[ "$NMEM_COMPOSE_FILES" == *compose.tls.yaml* ]]; then
      TLS_DOMAIN="$(resolve_tls_domain)"
    fi
    if [[ -n "$TLS_DOMAIN" ]]; then
      note "https://${TLS_DOMAIN}/app"
    else
      # Resolve an externally reachable URL hint, best-effort. `hostname -I`
      # is Linux-only and exits non-zero on macOS/BSD; the `|| true` keeps
      # that from tripping `set -euo pipefail` before the localhost fallback.
      if command -v hostname >/dev/null 2>&1; then
        IP="$(hostname -I 2>/dev/null | awk '{print $1}')" || true
      fi
      : "${IP:=localhost}"
      note "http://${IP}:14242/app"
    fi
    note "(paste the key above when asked for an API key)"
    ;;

  activate)
    code="${2:-}"
    [[ -n "$code" ]] || fail "usage: $0 activate <BASE64_LICENSE_CODE>"
    # `docker compose exec` only works against a running container. On a
    # fresh install (or after `docker compose down`) `activate` would
    # otherwise fail with "service is not running". Bring the stack up
    # idempotently before issuing the activation.
    bring_up_and_wait
    step "Activating license"
    "${DC[@]}" exec -T "$SVC" nmem license activate "$code"
    step "License status"
    "${DC[@]}" exec -T "$SVC" nmem license status
    ;;

  rotate-key)
    # Same rationale as `activate`: `docker compose exec` requires a
    # running container, so make rotation work even after `docker
    # compose down`.
    bring_up_and_wait
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
