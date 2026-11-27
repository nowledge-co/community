#!/bin/sh
# Select a Python runtime before handing it the one-shot hook input.
script_dir=${0%/*}
for candidate in python3 python; do
  if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' </dev/null >/dev/null 2>&1; then
    exec "$candidate" "$script_dir/bridge-host-hook.py" codebuddy
  fi
done
if py -3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' </dev/null >/dev/null 2>&1; then
  exec py -3 "$script_dir/bridge-host-hook.py" codebuddy
fi
printf '{}\n'
