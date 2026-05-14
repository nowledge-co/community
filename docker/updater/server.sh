#!/bin/sh
# Updater HTTP handler. Invoked once per incoming connection by socat
# (see entrypoint.sh). Reads an HTTP request on stdin, writes an HTTP
# response on stdout, exits.
#
# Routes:
#   GET  /healthz                  → 200 if alive
#   GET  /status                   → cached_tags, pull_in_progress, running tag
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
#   - Atomic snapshot: write to .tmp, mv to final name. Never leave a
#     half-written tar masquerading as a valid snapshot.
#   - Single-flight lock: ./cache/_upgrade.lock holds PID+timestamp.
#     Concurrent /apply gets 409. Stale lock (>30 min, PID dead) is
#     auto-cleared.
#   - /livez watch after recreate: poll up to NOWLEDGE_LIVEZ_TIMEOUT_SECONDS.
#     If never green, return failure with snapshot path so the operator
#     can decide whether to restore or debug forward.
#   - Last-N snapshot rotation: keep newest NOWLEDGE_SNAPSHOT_RETAIN
#     `_pre-upgrade-*.tar.gz`; delete older.
#   - All endpoints log to stderr (captured by socat) for the audit trail.

set -u

# ---- Config --------------------------------------------------------------
SNAPSHOT_DIR=/opt/snapshot/cache
DATA_DIR=/opt/snapshot/data
CONFIG_DIR=/opt/snapshot/config
LOCK_FILE="$SNAPSHOT_DIR/_upgrade.lock"
SCHED_STATUS="/opt/updater/cache/.last-scheduled-pull"
STALE_LOCK_AFTER=1800   # seconds (30 min)

# ---- HTTP helpers --------------------------------------------------------

# Emit an HTTP response. Body is read from stdin.
# Usage: printf '%s' "$json_body" | respond 200 'application/json'
respond() {
  status=$1
  ctype=${2:-application/json}
  body=$(cat)
  len=${#body}
  printf 'HTTP/1.0 %s\r\nContent-Type: %s\r\nContent-Length: %s\r\nConnection: close\r\n\r\n%s' \
    "$status" "$ctype" "$len" "$body"
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

# Lock file dance. Acquires /apply lock or returns 409.
acquire_lock() {
  if [ -f "$LOCK_FILE" ]; then
    held_pid=$(awk -F= '/^pid=/ {print $2}' "$LOCK_FILE" 2>/dev/null || true)
    held_ts=$(awk -F= '/^ts=/ {print $2}' "$LOCK_FILE" 2>/dev/null || true)
    now=$(date +%s)
    age=$(( now - ${held_ts:-0} ))
    pid_alive=0
    if [ -n "$held_pid" ] && kill -0 "$held_pid" 2>/dev/null; then
      pid_alive=1
    fi
    if [ "$pid_alive" -eq 1 ] && [ "$age" -lt "$STALE_LOCK_AFTER" ]; then
      audit "LOCK held by pid=$held_pid age=${age}s"
      respond_json 409 "$(jq -nc \
        --arg pid "$held_pid" --arg age "$age" \
        '{error:"upgrade in progress", pid:$pid, age_seconds:($age|tonumber)}')"
      exit 0
    fi
    audit "LOCK stale (pid=$held_pid age=${age}s) — taking over"
    rm -f "$LOCK_FILE"
  fi
  printf 'pid=%s\nts=%s\n' "$$" "$(date +%s)" > "$LOCK_FILE"
}

release_lock() {
  rm -f "$LOCK_FILE"
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

    # What Mem image tags are cached locally?
    cached_tags=$(docker images --format '{{.Repository}}:{{.Tag}}' "$NOWLEDGE_MEM_IMAGE" 2>/dev/null \
      | awk -F: '{print $NF}' | sort -u | jq -Rsc 'split("\n") | map(select(length>0))')
    cached_tags=${cached_tags:-"[]"}

    # Last scheduled-pull status, if any.
    last_pull="null"
    if [ -f "$SCHED_STATUS" ]; then
      last_pull=$(cat "$SCHED_STATUS")
    fi

    # Upgrade in progress?
    in_progress=false
    if [ -f "$LOCK_FILE" ]; then
      held_pid=$(awk -F= '/^pid=/ {print $2}' "$LOCK_FILE" 2>/dev/null || true)
      if [ -n "$held_pid" ] && kill -0 "$held_pid" 2>/dev/null; then
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
    snapshot=".cache/_pre-upgrade-${ts}.tar.gz"
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
      if ! tar -czf "${snapshot_abs}.tmp" -C /opt/snapshot data config 2>&1 \
         | sed 's/^/tar: /' >&2 ; then
        :
      fi
      if [ ! -s "${snapshot_abs}.tmp" ]; then
        audit "APPLY snapshot failed — restarting mem on old image"
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
      # Layered overlays (TLS, etc.) are picked up via NMEM_STATE_OVERLAYS,
      # which `./nmemctl auto-update enable` records in .nmemctl-state.
      # We deliberately do NOT source that file here — we ONLY recreate
      # the mem service, which doesn't need the overlays' definitions to
      # be present on the apply call. Operator-side restart will handle
      # full-stack recreates.
      export NMEM_IMAGE_TAG="$tag"
      if ! docker compose -f /opt/compose/compose.yaml \
              up -d --no-deps "$NOWLEDGE_MEM_SERVICE" >/dev/null 2>&1; then
        audit "APPLY compose up failed — mem may be on old image"
        exit 3
      fi
      audit "APPLY compose up ok (.env persisted NMEM_IMAGE_TAG=$tag), waiting for /livez"

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
