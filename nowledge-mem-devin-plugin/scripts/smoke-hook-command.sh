#!/usr/bin/env bash
# Runs the plugin's pinned hook command the way Devin does, with `sh -c` and
# the hook payload on stdin, against a stub CLI. On Windows the stub is an
# nmem.cmd, so this proves the fallback reaches it; elsewhere it is an nmem
# script. Either way the arguments, stdin, stdout, and exit status must pass
# through.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
command=$(node -e 'console.log(require(process.argv[1]).Stop[0].hooks[0].command)' "$root/hooks.json")
args='--json t sync --from devin --hook-stdin --apply'
stub=$(mktemp -d)
trap 'rm -rf "$stub"' EXIT

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    printf '@echo off\r\nif not "%%*"=="%s" exit /b 8\r\nfindstr /c:"session_id" >nul || exit /b 9\r\necho {}\r\nexit /b 3\r\n' "$args" >"$stub/nmem.cmd"
    ;;
  *)
    printf '#!/bin/sh\n[ "$*" = "%s" ] || exit 8\ngrep -q session_id || exit 9\necho "{}"\nexit 3\n' "$args" >"$stub/nmem"
    chmod +x "$stub/nmem"
    ;;
esac

set +e
out=$(printf '{"hook_event_name":"Stop","session_id":"smoke"}' | PATH="$stub:$PATH" sh -c "$command")
status=$?
set -e
out=${out//$'\r'/}

if [ "$status" -ne 3 ] || [ "$out" != "{}" ]; then
  echo "Hook command smoke test failed: exit $status, stdout '$out'" >&2
  exit 1
fi
echo "The hook command reached the stub CLI and kept its arguments, stdin, output, and exit status."
