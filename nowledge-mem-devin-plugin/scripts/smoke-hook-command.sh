#!/usr/bin/env bash
# Runs the plugin's pinned hook command the way Devin does, in a POSIX shell with
# the hook payload on stdin, against a stub CLI. On Windows the stub is an
# nmem.cmd, so this proves the fallback reaches it; elsewhere it is an nmem
# script. Either way stdin, stdout, and the exit status must pass through.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
command=$(node -e 'console.log(require(process.argv[1]).Stop[0].hooks[0].command)' "$root/hooks.json")
stub=$(mktemp -d)
trap 'rm -rf "$stub"' EXIT

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    printf '@echo off\r\nfindstr /c:"session_id" >nul || exit /b 9\r\necho {}\r\nexit /b 3\r\n' >"$stub/nmem.cmd"
    ;;
  *)
    printf '#!/bin/sh\ngrep -q session_id || exit 9\necho "{}"\nexit 3\n' >"$stub/nmem"
    chmod +x "$stub/nmem"
    ;;
esac

set +e
out=$(printf '{"hook_event_name":"Stop","session_id":"smoke"}' | PATH="$stub:$PATH" bash -c "$command")
status=$?
set -e
out=${out//$'\r'/}

if [ "$status" -ne 3 ] || [ "$out" != "{}" ]; then
  echo "Hook command smoke test failed: exit $status, stdout '$out'" >&2
  exit 1
fi
echo "The hook command reached the stub CLI and kept its stdin, output, and exit status."
