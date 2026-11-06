#!/bin/sh
# Starts a Nowledge Mem hook for Dim with an isolated Python interpreter.
#
# Python is selected from absolute PATH entries only, so a relative PATH entry
# or the working directory can never supply the interpreter. The hook is
# fail-open: when no trusted interpreter exists this exits 0 and Dim continues.
set -u
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 0
event="${1:-}"
if [ "$event" = "prompt" ]; then
  # Static text; printing it here avoids starting Python on every prompt.
  cat >/dev/null 2>&1 || :
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[Nowledge Mem] Before concluding work that depends on prior context, run one targeted memory or thread search. The startup briefing can be stale; read Working Memory again for the current view. Keep the configured identity and Space. Report retrieval failures briefly, never as no matches."}}'
  exit 0
fi
case "$event" in
  context) script=nmem_hook.py ;;
  capture) script=nmem_capture.py ;;
  *) exit 0 ;;
esac
python=""
old_ifs=$IFS
IFS=:
for name in python3 python; do
  for entry in $PATH; do
    case "$entry" in
      /*) : ;;
      *) continue ;;
    esac
    if [ -f "$entry/$name" ] && [ -x "$entry/$name" ]; then
      python="$entry/$name"
      break
    fi
  done
  [ -n "$python" ] && break
done
IFS=$old_ifs
[ -n "$python" ] || exit 0
exec "$python" -I "$here/$script" "$event"
