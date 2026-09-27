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
exit 0
