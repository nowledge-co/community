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

# Pull both the literal tag the operator's stack is pinned to AND
# `:latest`. The first is useful for re-pulling exact-version updates
# (in case of a tag move); the second is what surfaces "X.Y.Z available"
# to the UI.
#
# We do not pull `:X.Y` (rolling minor) because operators who want patch
# updates should still consent to them via the Apply button.
pull_once() {
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  for ref in "${NOWLEDGE_MEM_IMAGE}:latest"; do
    if docker pull "$ref" >/tmp/pull.log 2>&1; then
      printf 'scheduler: pulled %s ok at %s\n' "$ref" "$ts"
      printf '{"image":"%s","ok":true,"at":"%s"}\n' "$ref" "$ts" \
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
