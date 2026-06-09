#!/bin/sh
# Best-effort Context Bundle / Working Memory injection for Claude Code lifecycle hooks.

if ! command -v nmem >/dev/null 2>&1; then
  if command -v nmem.cmd >/dev/null 2>&1; then
    escape_cmd_arg() {
      printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
    }

    nmem() {
      q=""
      for a in "$@"; do
        q="$q \"$(escape_cmd_arg "$a")\""
      done
      cmd.exe /s /c "\"nmem.cmd\"$q"
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
AGENT_ID="${NMEM_AGENT_ID:-}"
HOST_AGENT_ID="${NMEM_HOST_AGENT_ID:-}"

parse_context='import sys,json; d=json.load(sys.stdin); c=d.get("rendered_markdown") or d.get("content") or ""; print(c) if c else sys.exit(1)'
parse_existing_space_wm='import sys,json; d=json.load(sys.stdin); c=d.get("content",""); print(c) if d.get("exists") and c else sys.exit(1)'
parse_default_wm='import sys,json; d=json.load(sys.stdin); c=d.get("content",""); print(c) if c else sys.exit(1)'

try_context() {
  target_space="$1"
  set -- context --source-app claude-code
  [ -n "$AGENT_ID" ] && set -- "$@" --agent-id "$AGENT_ID"
  [ -n "$HOST_AGENT_ID" ] && set -- "$@" --host-agent-id "$HOST_AGENT_ID"
  [ -n "$target_space" ] && set -- "$@" --space "$target_space"
  nmem --json "$@" 2>/dev/null | "$PY" -c "$parse_context" 2>/dev/null
}

if command -v nmem >/dev/null 2>&1 && [ -n "$PY" ]; then
  if [ -n "$SPACE" ] && try_context "$SPACE"; then
    exit 0
  fi

  if try_context ""; then
    exit 0
  fi

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
