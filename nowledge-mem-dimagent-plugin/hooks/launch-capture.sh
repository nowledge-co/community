#!/bin/sh

# Choose an interpreter before importing anything from the host project.
set -f
original_ifs=$IFS
for interpreter in python3 python; do
    IFS=:
    for directory in ${PATH:-}; do
        IFS=$original_ifs
        case "$directory" in
            /*) ;;
            *) continue ;;
        esac
        candidate="$directory/$interpreter"
        if [ -f "$candidate" ] && [ -x "$candidate" ]; then
            "$candidate" -I "$CLAUDE_PLUGIN_ROOT/hooks/nmem-capture.py" && exit 0
        fi
    done
done
bootstrap_root=${DIMCODE_HOME:-${HOME:+$HOME/.dim}}
if [ -n "$bootstrap_root" ]; then
    # A fixed overwrite stays bounded even when Python never starts.
    (
        umask 077
        /bin/mkdir -p "$bootstrap_root/logs" &&
            printf '%s\n' 'capture skipped: trusted Python launcher unavailable or failed' > \
                "$bootstrap_root/logs/nowledge-mem-capture-bootstrap.log"
    ) 2>/dev/null
fi
exit 0
