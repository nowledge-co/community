#!/bin/sh
# Background pull scheduler. Pulls the configured Mem image on a cadence
# so that when the operator clicks Apply, the new layers are already on
# disk and the actual downtime is just stop+start, not download time.
#
# Idempotent: docker pull with no new layers is a no-op.
# Cheap: ~10kB of registry traffic when nothing changed.
#
# Errors are logged but never crash the scheduler — registry transient
# failures should not take the sidecar down.
set -u

last_status_path=/opt/updater/cache/.last-scheduled-pull
mkdir -p /opt/updater/cache

# Pull `:latest` AND the literal tag the operator's stack is pinned to.
# `:latest` is what surfaces "X.Y.Z available" to the UI by widening the
# local image cache to the newest published version. The pinned tag is
# pulled to absorb potential tag-moves (a published `:X.Y.Z` that was
# repushed after an emergency fix). We discover the pinned tag from the
# running mem container's image config rather than baking it in — that
# way the scheduler stays in sync with operator-side `./nmemctl upgrade`.
#
# We do NOT pull `:X.Y` (rolling minor) because operators who want patch
# updates should still consent to them via the Apply button.
pull_once() {
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  refs="${NOWLEDGE_MEM_IMAGE}:latest"
  pinned_tag=$(docker inspect --format '{{.Config.Image}}' \
                  "$NOWLEDGE_MEM_CONTAINER" 2>/dev/null \
                | awk -F: '{print $NF}')
  if [ -n "$pinned_tag" ] && [ "$pinned_tag" != "latest" ]; then
    refs="$refs ${NOWLEDGE_MEM_IMAGE}:${pinned_tag}"
  fi

  for ref in $refs; do
    if docker pull "$ref" >/tmp/pull.log 2>&1; then
      printf 'scheduler: pulled %s ok at %s\n' "$ref" "$ts"
      jq -nc --arg image "$ref" --arg at "$ts" \
        '{image:$image,ok:true,at:$at}' \
        > "$last_status_path.tmp" && mv "$last_status_path.tmp" "$last_status_path"
    else
      err=$(tail -n 3 /tmp/pull.log | tr '\n' ' ')
      printf >&2 'scheduler: pull %s failed at %s: %s\n' "$ref" "$ts" "$err"
      printf '{"image":"%s","ok":false,"at":"%s","error":%s}\n' \
        "$ref" "$ts" "$(printf '%s' "$err" | jq -Rs .)" \
        > "$last_status_path.tmp" && mv "$last_status_path.tmp" "$last_status_path"
    fi
  done
}

# Stagger the first pull by 60s so a freshly-deployed stack doesn't
# hammer the registry while the operator is still configuring things.
sleep 60

while :; do
  pull_once
  sleep "$NOWLEDGE_PULL_INTERVAL_SECONDS"
done
