#!/bin/sh
# Best-effort Working Memory injection for Claude Code lifecycle hooks.

if ! command -v nmem >/dev/null 2>&1; then
  NMEM_CMD="$(command -v nmem.cmd 2>/dev/null || true)"
  if [ -n "$NMEM_CMD" ]; then
    nmem() {
      q=""
      for a in "$@"; do
        q="$q \"$a\""
      done
      cmd.exe /s /c "\"$NMEM_CMD\"$q"
    }
  fi
fi

PY="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"

resolve_space() {
  if [ -n "${NMEM_SPACE:-}" ]; then
    printf '%s\n' "$NMEM_SPACE"
    return 0
  fi

  common_dir="$(git rev-parse --git-common-dir 2>/dev/null)" || return 0
  [ -n "$common_dir" ] || return 0

  case "$common_dir" in
    /*) common_path="$common_dir" ;;
    *) common_path="$(pwd -P)/$common_dir" ;;
  esac

  common_parent="$(cd "$(dirname "$common_path")" 2>/dev/null && pwd -P)" || return 0
  basename "$common_parent" 2>/dev/null | tr '[:upper:]' '[:lower:]'
}

SPACE="$(resolve_space)"

parse_existing_space_wm='import sys,json; d=json.load(sys.stdin); c=d.get("content",""); print(c) if d.get("exists") and c else sys.exit(1)'
parse_default_wm='import sys,json; d=json.load(sys.stdin); c=d.get("content",""); print(c) if c else sys.exit(1)'

if command -v nmem >/dev/null 2>&1 && [ -n "$PY" ]; then
  if [ -n "$SPACE" ] \
    && nmem --json wm read --space "$SPACE" 2>/dev/null \
      | "$PY" -c "$parse_existing_space_wm" 2>/dev/null; then
    exit 0
  fi

  if nmem --json wm read 2>/dev/null \
    | "$PY" -c "$parse_default_wm" 2>/dev/null; then
    exit 0
  fi
fi

cat "$HOME/ai-now/memory.md" 2>/dev/null || true
