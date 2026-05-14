#!/bin/sh
# Updater sidecar entrypoint. Two concurrent jobs under one tini parent:
#
#   1. socat HTTP server on :8080 — dispatches each request to server.sh
#      as a child process. Single-flight semantics are enforced inside
#      server.sh by a lock file, not by socat.
#
#   2. scheduler.sh — periodic background `docker pull` so the new image
#      is cached locally before the operator clicks Apply. Cadence
#      controlled by NOWLEDGE_PULL_INTERVAL_SECONDS (0 disables).
#
# Exiting either job exits the container; restart_policy: unless-stopped
# brings it back. We do NOT trap-and-restart inside; let Docker do its
# job.
set -eu

require_env() {
  if [ -z "${1:-}" ]; then
    printf >&2 'updater: missing required env var %s\n' "$2"
    exit 64
  fi
}

require_env "${NOWLEDGE_UPDATER_TOKEN:-}" NOWLEDGE_UPDATER_TOKEN
require_env "${NOWLEDGE_MEM_CONTAINER:-}" NOWLEDGE_MEM_CONTAINER
require_env "${NOWLEDGE_MEM_IMAGE:-}" NOWLEDGE_MEM_IMAGE

# Compose-side identifiers vs docker-engine-side. The compose service
# name (`mem` by default in the reference stack) is what we pass to
# `docker compose up`. The container name (`nowledge-mem`) is what we
# pass to `docker stop` / `docker inspect`. Operators who renamed
# either side in their compose.yaml override these.
: "${NOWLEDGE_MEM_SERVICE:=mem}"
: "${NOWLEDGE_PULL_INTERVAL_SECONDS:=86400}"
: "${NOWLEDGE_SNAPSHOT_RETAIN:=3}"
: "${NOWLEDGE_LIVEZ_TIMEOUT_SECONDS:=60}"
export NOWLEDGE_MEM_SERVICE NOWLEDGE_PULL_INTERVAL_SECONDS \
       NOWLEDGE_SNAPSHOT_RETAIN NOWLEDGE_LIVEZ_TIMEOUT_SECONDS

# Sanity: docker socket must be present and reachable. Fail fast at
# startup rather than at the first request — operators can read the
# exit code in `docker logs nowledge-mem-updater` and diagnose. The
# mem container is unaffected: it has no `depends_on` on the updater,
# so it continues to serve even if this sidecar restart-loops.
if ! docker version >/dev/null 2>&1; then
  printf >&2 'updater: cannot talk to docker daemon at /var/run/docker.sock.\n'
  printf >&2 'updater: likely causes:\n'
  printf >&2 '  - socket not bind-mounted into the sidecar (check compose.updater.yaml)\n'
  printf >&2 '  - rootless docker / podman with a different socket path\n'
  printf >&2 '  - SELinux/AppArmor blocking socket access (try :Z on the mount)\n'
  printf >&2 'updater: mem continues to run; the web UI will show "auto-update unavailable".\n'
  exit 65
fi

printf 'updater: starting (mem container=%s, image=%s, pull every %ss)\n' \
  "$NOWLEDGE_MEM_CONTAINER" "$NOWLEDGE_MEM_IMAGE" "$NOWLEDGE_PULL_INTERVAL_SECONDS"

# Scheduler in background. fork=true on socat below means the http
# server is also non-blocking, so the foreground wait works.
if [ "$NOWLEDGE_PULL_INTERVAL_SECONDS" -gt 0 ]; then
  /opt/updater/scheduler.sh &
fi

# socat passes each connection's request to server.sh on stdin and
# captures its stdout as the response. fork=true makes it handle
# multiple concurrent connections; server.sh's lock file is what
# prevents simultaneous /apply calls.
exec socat -T 30 TCP-LISTEN:8080,reuseaddr,fork EXEC:/opt/updater/server.sh,stderr
