#!/bin/sh
# Updater HTTP handler. Invoked once per incoming connection by socat
# (see entrypoint.sh). Reads an HTTP request on stdin, writes an HTTP
# response on stdout, exits.
#
# Shebang note: `/bin/sh` on alpine resolves to busybox `ash`, which
# DOES support `$'\r'` (ANSI-C quoting) for CRLF stripping even though
# strict POSIX does not. We deliberately depend on busybox's `ash`
# behavior here rather than adding bash to the image (saves ~3 MB).
# This script is NOT portable to dash; alpine is the only runtime we
# ship it on, and the Dockerfile pins alpine:3.20.
#
# Routes:
#   GET  /healthz                  → 200 if alive
#   GET  /status                   → running_image, cached_tags, last_pull,
#                                    snapshots, upgrade_in_progress
#   POST /pull?tag=X.Y.Z           → docker pull (idempotent, no downtime)
#   POST /apply?tag=X.Y.Z          → snapshot + recreate (~30s downtime)
#
# Every route except /healthz requires `Authorization: Bearer $TOKEN`.
#
# Invariants from docs/design/HEADLESS_UPGRADE_UX.md:
#
#   - Free-space precheck BEFORE docker stop. If insufficient, return
#     412 and leave the container running. Stopping without space to
#     snapshot would corrupt the only safety net.
#   - Atomic snapshot: tar exit status captured directly (not through a
#     pipeline that would mask failures), then mv .tmp → final only on
#     success. Never leave a half-written tar masquerading as valid.
#   - Single-flight lock: ./cache/_upgrade.lock.d is an atomic mkdir
#     DIRECTORY with a timestamp-only `owner` file inside. Concurrent
#     /apply gets 409. Staleness is judged by timestamp age (the
#     detached worker is a fresh subshell, so PID-liveness checks
#     would always claim stale and double-fire apply).
#   - /livez watch after recreate: poll up to NOWLEDGE_LIVEZ_TIMEOUT_SECONDS.
#     If never green, return failure with snapshot path so the operator
#     can decide whether to restore or debug forward.
#   - Last-N snapshot rotation: keep newest NOWLEDGE_SNAPSHOT_RETAIN
#     `_pre-upgrade-*.tar.gz`; delete older.
#   - All endpoints log to stderr (captured by `docker logs`) for the
#     audit trail. socat's `stderr` option is INTENTIONALLY NOT used
#     in entrypoint.sh so audit lines don't fold into HTTP responses.

set -u

# ---- Config --------------------------------------------------------------
SNAPSHOT_DIR=/opt/snapshot/cache
DATA_DIR=/opt/snapshot/data
CONFIG_DIR=/opt/snapshot/config
LOCK_FILE="$SNAPSHOT_DIR/_upgrade.lock"
SCHED_STATUS="/opt/updater/cache/.last-scheduled-pull"
STALE_LOCK_AFTER=1800   # seconds (30 min)

# ---- HTTP helpers --------------------------------------------------------

# HTTP-status-code → reason phrase. Strict clients (modern curl) reject
# responses without a reason phrase and fall back to HTTP/0.9 parsing,
# which manifests as "Received HTTP/0.9 when not allowed" on the caller.
status_phrase() {
  case "$1" in
    200) printf 'OK' ;;
    202) printf 'Accepted' ;;
    400) printf 'Bad Request' ;;
    401) printf 'Unauthorized' ;;
    404) printf 'Not Found' ;;
    409) printf 'Conflict' ;;
    412) printf 'Precondition Failed' ;;
    500) printf 'Internal Server Error' ;;
    502) printf 'Bad Gateway' ;;
    *)   printf 'Status' ;;
  esac
}

# Emit an HTTP response. Body is read from stdin. Status line is
# `HTTP/1.0 <code> <reason>` per RFC 1945 / RFC 9110.
respond() {
  status=$1
  ctype=${2:-application/json}
  body=$(cat)
  # Byte length — accurate for UTF-8 since `${#var}` in dash counts bytes.
  # printf's %s emits the exact bytes, so wc -c matches.
  len=$(printf '%s' "$body" | wc -c | tr -d ' ')
  phrase=$(status_phrase "$status")
  printf 'HTTP/1.0 %s %s\r\nContent-Type: %s\r\nContent-Length: %s\r\nConnection: close\r\n\r\n%s' \
    "$status" "$phrase" "$ctype" "$len" "$body"
}

# Build a JSON response body and emit it.
# Usage: respond_json 200 '{"ok": true}'
respond_json() {
  printf '%s' "$2" | respond "$1" 'application/json'
}

# Audit log line on stderr. socat captures these.
audit() {
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf >&2 'updater[%s] %s %s\n' "$$" "$ts" "$*"
}

# ---- Parse the request ---------------------------------------------------

# Read the first request line.
IFS= read -r request_line || { respond_json 400 '{"error":"empty request"}'; exit 0; }
request_line=${request_line%$'\r'}
method=${request_line%% *}
rest=${request_line#"$method "}
target=${rest%% *}
path=${target%%\?*}
case "$target" in
  *\?*) query=${target#*\?} ;;
  *)    query="" ;;
esac

# Read headers until blank line. Capture only what we need.
auth_header=""
while IFS= read -r header_line; do
  header_line=${header_line%$'\r'}
  [ -z "$header_line" ] && break
  lname=$(printf '%s' "${header_line%%:*}" | tr 'A-Z' 'a-z')
  lval=${header_line#*: }
  case "$lname" in
    authorization) auth_header=$lval ;;
  esac
done

audit "REQ $method $path query=$query"

# ---- Helpers -------------------------------------------------------------

# Extract a query parameter. Usage: q=$(qparam tag)
qparam() {
  printf '%s' "$query" | tr '&' '\n' \
    | awk -F= -v k="$1" '$1==k { sub("^"k"=","",$0); print; exit }'
}

# Validate a version tag string. Accept X.Y.Z and X.Y.Z-suffix.
# Reject anything with slashes, spaces, quotes, etc — the tag flows
# directly into a `docker pull <image>:<tag>` shell-out below.
valid_tag() {
  printf '%s' "$1" | grep -Eq '^[A-Za-z0-9_.-]{1,64}$'
}

# Authn check. Returns 0 if Bearer token matches; emits 401 + exits otherwise.
require_auth() {
  expected="Bearer $NOWLEDGE_UPDATER_TOKEN"
  if [ "$auth_header" != "$expected" ]; then
    audit "AUTH FAIL"
    respond_json 401 '{"error":"unauthorized"}'
    exit 0
  fi
}

# Single-flight lock. Atomic via `mkdir` — succeeds or fails as one
# syscall, with no TOCTOU window. Plain file-based [ -f X ] + write is
# racy: two concurrent requests can both observe absent and both write.
#
# Liveness model: stale-by-TIMESTAMP only, not by PID. The main socat
# child that calls acquire_lock exits as soon as it emits the 202; the
# work runs in a detached subshell whose PID we don't write into the
# lock. A PID-liveness check on the main process would always see
# "dead" after a few seconds, falsely concluding stale and double-firing
# apply. Timestamp age is the right signal.
LOCK_DIR="${LOCK_FILE}.d"

acquire_lock() {
  # First-attempt atomic mkdir. If it succeeds, we hold the lock.
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf 'ts=%s\n' "$(date +%s)" > "$LOCK_DIR/owner"
    return 0
  fi

  # Someone else holds it. Check staleness by mtime of the lock dir.
  held_ts=$(awk -F= '/^ts=/ {print $2}' "$LOCK_DIR/owner" 2>/dev/null || true)
  if [ -z "$held_ts" ]; then
    # No owner file inside — fall back to dir mtime.
    held_ts=$(stat -c '%Y' "$LOCK_DIR" 2>/dev/null || echo 0)
  fi
  now=$(date +%s)
  age=$(( now - ${held_ts:-0} ))
  if [ "$age" -lt "$STALE_LOCK_AFTER" ]; then
    audit "LOCK held (age=${age}s)"
    respond_json 409 "$(jq -nc \
      --arg age "$age" \
      '{error:"upgrade in progress", age_seconds:($age|tonumber)}')"
    exit 0
  fi

  # Stale. Clear and re-acquire atomically. If re-acquire races and
  # loses, surface 409 cleanly.
  audit "LOCK stale (age=${age}s) — taking over"
  rm -f "$LOCK_DIR/owner"
  rmdir "$LOCK_DIR" 2>/dev/null || true
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf 'ts=%s\n' "$(date +%s)" > "$LOCK_DIR/owner"
    return 0
  fi
  audit "LOCK contended on re-acquire"
  respond_json 409 '{"error":"upgrade contended; retry"}'
  exit 0
}

release_lock() {
  rm -f "$LOCK_DIR/owner" 2>/dev/null || true
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

# ---- Route: GET /healthz -------------------------------------------------
case "$method $path" in
  "GET /healthz")
    respond_json 200 '{"ok":true}'
    exit 0
    ;;
esac

# Everything below requires the bearer token.
require_auth

# ---- Route: GET /status --------------------------------------------------
case "$method $path" in
  "GET /status")
    # What's the running container on now?
    running_image=$(docker inspect --format '{{.Config.Image}}' \
      "$NOWLEDGE_MEM_CONTAINER" 2>/dev/null || printf 'unknown')

    # What Mem image tags are cached locally? Docker normalizes images
    # stored locally to drop the `docker.io/` prefix, so a filter like
    # `docker images docker.io/nowledgelabs/mem` returns empty. Strip
    # the prefix before filtering so both forms match.
    short_image=${NOWLEDGE_MEM_IMAGE#docker.io/}
    cached_tags=$(docker images --format '{{.Repository}}:{{.Tag}}' "$short_image" 2>/dev/null \
      | awk -F: '{print $NF}' | sort -u | jq -Rsc 'split("\n") | map(select(length>0))')
    cached_tags=${cached_tags:-"[]"}

    # Last scheduled-pull status, if any.
    last_pull="null"
    if [ -f "$SCHED_STATUS" ]; then
      last_pull=$(cat "$SCHED_STATUS")
    fi

    # Upgrade in progress? The lock is now an atomic mkdir directory
    # (LOCK_DIR = ${LOCK_FILE}.d) with a timestamp-only `owner` file
    # inside — staleness is judged by age, not PID liveness, because
    # the subshell doing the work isn't the lock-acquirer process.
    in_progress=false
    if [ -d "$LOCK_DIR" ]; then
      held_ts=$(awk -F= '/^ts=/ {print $2}' "$LOCK_DIR/owner" 2>/dev/null || true)
      if [ -z "$held_ts" ]; then
        held_ts=$(stat -c '%Y' "$LOCK_DIR" 2>/dev/null || echo 0)
      fi
      now=$(date +%s)
      age=$(( now - ${held_ts:-0} ))
      if [ "$age" -lt "$STALE_LOCK_AFTER" ]; then
        in_progress=true
      fi
    fi

    # Existing snapshots (newest first).
    snapshots=$(ls -1t "$SNAPSHOT_DIR"/_pre-upgrade-*.tar.gz 2>/dev/null \
      | jq -Rsc 'split("\n") | map(select(length>0) | sub("^/opt/snapshot/cache/"; "./cache/"))')
    snapshots=${snapshots:-"[]"}

    body=$(jq -nc \
      --arg running "$running_image" \
      --argjson cached "$cached_tags" \
      --argjson last_pull "$last_pull" \
      --argjson snapshots "$snapshots" \
      --argjson in_progress "$in_progress" \
      '{running_image:$running, cached_tags:$cached, last_pull:$last_pull,
        snapshots:$snapshots, upgrade_in_progress:$in_progress}')
    respond_json 200 "$body"
    exit 0
    ;;
esac

# ---- Route: POST /pull ---------------------------------------------------
case "$method $path" in
  "POST /pull")
    tag=$(qparam tag)
    [ -z "$tag" ] && tag="latest"
    if ! valid_tag "$tag"; then
      respond_json 400 '{"error":"invalid tag"}'
      exit 0
    fi
    ref="${NOWLEDGE_MEM_IMAGE}:${tag}"
    audit "PULL $ref"
    if docker pull "$ref" >/tmp/pull-$$.log 2>&1; then
      audit "PULL ok $ref"
      respond_json 200 "$(jq -nc --arg ref "$ref" '{ok:true, ref:$ref}')"
    else
      err=$(tail -n 5 /tmp/pull-$$.log | tr '\n' ' ')
      audit "PULL fail $ref: $err"
      respond_json 502 "$(jq -nc --arg ref "$ref" --arg err "$err" \
        '{ok:false, ref:$ref, error:$err}')"
    fi
    rm -f /tmp/pull-$$.log
    exit 0
    ;;
esac

# ---- Route: POST /apply --------------------------------------------------
case "$method $path" in
  "POST /apply")
    tag=$(qparam tag)
    if ! valid_tag "$tag"; then
      respond_json 400 '{"error":"invalid or missing tag"}'
      exit 0
    fi
    ref="${NOWLEDGE_MEM_IMAGE}:${tag}"

    # Image must already be cached locally — Apply does NOT pull. If
    # the caller wants to skip the pull-first contract, they POST /pull
    # explicitly first. This keeps Apply's failure modes narrow.
    if ! docker image inspect "$ref" >/dev/null 2>&1; then
      audit "APPLY $ref — not cached, refusing"
      respond_json 412 "$(jq -nc --arg ref "$ref" \
        '{error:"image not cached — call POST /pull first", ref:$ref}')"
      exit 0
    fi

    # Free-space precheck. Need (size(data)+size(config)) * 1.5 free.
    data_kb=$(du -sk "$DATA_DIR" 2>/dev/null | awk '{print $1}')
    config_kb=$(du -sk "$CONFIG_DIR" 2>/dev/null | awk '{print $1}')
    needed_kb=$(( (data_kb + config_kb) * 3 / 2 ))
    avail_kb=$(df --output=avail "$SNAPSHOT_DIR" 2>/dev/null | awk 'NR==2 {print $1}')
    if [ -z "${avail_kb:-}" ] || [ "$avail_kb" -lt "$needed_kb" ]; then
      audit "APPLY $ref — insufficient space (need ${needed_kb}kB, have ${avail_kb:-0}kB)"
      respond_json 412 "$(jq -nc \
        --arg needed "$needed_kb" --arg avail "${avail_kb:-0}" \
        '{error:"insufficient disk space for pre-upgrade snapshot",
          needed_kb:($needed|tonumber), available_kb:($avail|tonumber)}')"
      exit 0
    fi

    # Single-flight lock. Emits its own 409 response on conflict.
    acquire_lock

    # Detach the long-running work. Apply takes 30-60s and we want the
    # caller to get a fast 202 with the snapshot path. The detached
    # worker logs everything via audit() to stderr, captured by socat.
    ts=$(date -u +%Y%m%dT%H%M%SZ)
    # ./cache/ (visible) — the operator can ls this from the host.
    # The earlier .cache/ (hidden dotted dir) was a bug.
    snapshot="./cache/_pre-upgrade-${ts}.tar.gz"
    snapshot_abs="$SNAPSHOT_DIR/_pre-upgrade-${ts}.tar.gz"

    (
      # Recreate the failure semantics inside the subshell: any error
      # releases the lock and logs.
      trap 'release_lock' EXIT
      audit "APPLY start ref=$ref snapshot=$snapshot"

      # Step 1: stop the mem container.
      if ! docker stop -t 30 "$NOWLEDGE_MEM_CONTAINER" >/dev/null 2>&1; then
        audit "APPLY stop failed"
        exit 1
      fi
      audit "APPLY stopped"

      # Step 2: atomic snapshot. Tar from /opt/snapshot (which has data
      # and config bind-mounted RO). Exclude cache by virtue of not
      # tarring it. Write .tmp first, then rename.
      #
      # IMPORTANT: capture tar's exit status directly. In POSIX sh,
      # `tar … | sed …` returns sed's status, which would mask tar
      # failures and leave a half-written archive that the `-s` check
      # below would happily accept. We tee tar's stderr to a temp log
      # for the audit trail and check tar's exit code explicitly.
      tar_log=$(mktemp)
      tar -czf "${snapshot_abs}.tmp" -C /opt/snapshot data config 2>"$tar_log"
      tar_rc=$?
      if [ -s "$tar_log" ]; then
        sed 's/^/tar: /' < "$tar_log" >&2
      fi
      rm -f "$tar_log"
      if [ "$tar_rc" -ne 0 ] || [ ! -s "${snapshot_abs}.tmp" ]; then
        audit "APPLY snapshot failed (tar rc=$tar_rc) — restarting mem on old image"
        rm -f "${snapshot_abs}.tmp"
        docker start "$NOWLEDGE_MEM_CONTAINER" >/dev/null 2>&1 || true
        exit 2
      fi
      mv "${snapshot_abs}.tmp" "${snapshot_abs}"
      audit "APPLY snapshot ok $(du -h "$snapshot_abs" | awk '{print $1}')"

      # Step 3: rotate snapshots. Keep newest N.
      # shellcheck disable=SC2012
      ls -1t "$SNAPSHOT_DIR"/_pre-upgrade-*.tar.gz 2>/dev/null \
        | tail -n +"$((NOWLEDGE_SNAPSHOT_RETAIN + 1))" \
        | while read -r old; do
            audit "APPLY rotate rm $(basename "$old")"
            rm -f "$old"
          done

      # Step 4: persist the new tag to .env BEFORE the recreate. This way
      # if the recreate succeeds, future `./nmemctl up`/`restart` calls
      # use the new tag. If the recreate fails, the operator's recovery
      # path (./nmemctl restore-app from the snapshot + ./nmemctl upgrade
      # <old-tag>) will overwrite .env again. Atomic write via temp+mv.
      env_file="/opt/compose/.env"
      env_tmp="/opt/compose/.env.tmp.$$"
      {
        if [ -f "$env_file" ]; then
          grep -Ev '^NMEM_IMAGE_TAG=' "$env_file" || true
        fi
        printf 'NMEM_IMAGE_TAG=%s\n' "$tag"
      } > "$env_tmp"
      mv "$env_tmp" "$env_file"
      chmod 0600 "$env_file" 2>/dev/null || true

      # Step 5: recreate from new tag. compose up -d with NMEM_IMAGE_TAG
      # overridden in the calling environment. The operator's compose.yaml
      # is templated as `image: ...:${NMEM_IMAGE_TAG:-X.Y.Z}` (the
      # default in fresh installs from nmemctl 2.1.0+).
      #
      # CRITICAL: honor the operator's active overlay stack. If the
      # deploy uses compose.tls.yaml + compose.updater.yaml + a custom
      # override, recreating with only compose.yaml would lose the
      # caddy sidecar, the loopback rebind, and any operator-specific
      # config — breaking the deploy. nmemctl persists the active
      # overlays in .nmemctl-state (managed by `auto-update enable`,
      # `auto-update disable`, future TLS-toggle verbs, etc.) so the
      # sidecar can replay the same compose stack on recreate.
      compose_overlays=""
      if [ -f /opt/compose/.nmemctl-state ]; then
        # shellcheck disable=SC1091
        . /opt/compose/.nmemctl-state
        compose_overlays="${NMEM_STATE_OVERLAYS:-}"
      fi
      export NMEM_IMAGE_TAG="$tag"

      # Recover the operator's compose project name from the existing
      # container's docker-compose label. The default-derived name (from
      # the sidecar's cwd basename) would be "compose" — which doesn't
      # match the operator's project (whatever they `docker compose`-ed
      # from). Without this, --force-recreate would try to create a
      # NEW container with the operator's container_name (e.g.
      # "nowledge-mem"), which is already in use by THEIR project, and
      # the daemon rejects it with "container name already in use".
      project=$(docker inspect "$NOWLEDGE_MEM_CONTAINER" \
                  --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null)
      # Fallback when the container existed before compose v2's project
      # labels (very old deploys) or was created by hand outside compose.
      project_arg=""
      [ -n "$project" ] && project_arg="-p $project"

      # cd into the compose project dir so:
      #   - relative overlay paths ("-f compose.updater.yaml") resolve here,
      #     not against the sidecar's /opt/updater workdir;
      #   - compose auto-discovers .env from the project dir.
      # shellcheck disable=SC2086 — word-split $compose_overlays so
      # "-f a.yaml -f b.yaml" expands to multiple args.
      # --force-recreate stops + removes + creates fresh in one step.
      # We already explicitly `docker stop`-ed above to flush the DB; the
      # stopped container is still holding its name (it isn't removed by
      # plain `stop`), and a normal `up -d` would then conflict with
      # "container name in use". --force-recreate fixes that, and is the
      # right semantic for "apply a new image" regardless of any
      # config-change-detection that compose does implicitly.
      if ! ( cd /opt/compose && docker compose $project_arg -f compose.yaml $compose_overlays \
              up -d --no-deps --force-recreate "$NOWLEDGE_MEM_SERVICE" \
            ) 2>/tmp/compose-err-$$; then
        err=$(tr '\n' ' ' < /tmp/compose-err-$$ | head -c 400)
        rm -f /tmp/compose-err-$$
        audit "APPLY compose up failed — mem may be on old image: $err"
        exit 3
      fi
      rm -f /tmp/compose-err-$$
      audit "APPLY compose up ok (overlays=$compose_overlays, .env NMEM_IMAGE_TAG=$tag), waiting for /livez"

      # Step 6: wait for /livez green. Up to NOWLEDGE_LIVEZ_TIMEOUT_SECONDS.
      deadline=$(( $(date +%s) + NOWLEDGE_LIVEZ_TIMEOUT_SECONDS ))
      while :; do
        if docker exec "$NOWLEDGE_MEM_CONTAINER" \
             /opt/nowledge-mem/python/bin/python3 -c \
             "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:14242/livez', timeout=4).status==200 else 1)" \
             >/dev/null 2>&1; then
          audit "APPLY done ref=$ref"
          break
        fi
        if [ "$(date +%s)" -ge "$deadline" ]; then
          audit "APPLY /livez never green within ${NOWLEDGE_LIVEZ_TIMEOUT_SECONDS}s — see snapshot $snapshot"
          exit 4
        fi
        sleep 2
      done
    ) >&2 &
    detached_pid=$!

    body=$(jq -nc \
      --arg ref "$ref" \
      --arg snapshot "$snapshot" \
      --arg pid "$detached_pid" \
      '{accepted:true, ref:$ref, snapshot:$snapshot, pid:($pid|tonumber)}')
    respond_json 202 "$body"
    exit 0
    ;;
esac

# ---- Unmatched route -----------------------------------------------------
respond_json 404 '{"error":"not found"}'
exit 0
