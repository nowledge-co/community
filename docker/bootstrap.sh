#!/usr/bin/env bash
# bootstrap.sh has been replaced by ./nmemctl.
#
# This shim forwards to the new tool so anyone with stale docs / shell history
# doesn't hit a 404. It will be removed in a future release.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf "\033[1;33mnote:\033[0m bootstrap.sh is now ./nmemctl — forwarding.\n" >&2
exec "$SCRIPT_DIR/nmemctl" "$@"
