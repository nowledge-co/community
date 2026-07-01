#!/bin/sh
# Best-effort Context Bundle / Working Memory injection for Claude Code / Grok Build lifecycle hooks.

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
  # Space is a user-owned concept: only an explicit $NMEM_SPACE selects a lane.
  # We deliberately do NOT infer a space from cwd/git — the old repo-basename
  # derivation made captured threads surface repo-named spaces the user never
  # created. With no $NMEM_SPACE set, we read the user's default space.
  if [ -n "${NMEM_SPACE:-}" ]; then
    printf '%s\n' "$NMEM_SPACE"
  fi
  return 0
}

SPACE="$(resolve_space)"
AGENT_ID="${NMEM_AGENT_ID:-}"
HOST_AGENT_ID="${NMEM_HOST_AGENT_ID:-}"
SOURCE_APP="claude-code"
if [ -n "${GROK_SESSION_ID:-}" ] || [ -n "${GROK_HOOK_EVENT:-}" ] || [ -n "${GROK_WORKSPACE_ROOT:-}" ] || [ -n "${GROK_PLUGIN_ROOT:-}" ]; then
  SOURCE_APP="grok"
fi

parse_context='import sys,json; d=json.load(sys.stdin); c=d.get("rendered_markdown") or d.get("content") or ""; print(c) if c else sys.exit(1)'
parse_existing_space_wm='import sys,json; d=json.load(sys.stdin); c=d.get("content",""); print(c) if d.get("exists") and c else sys.exit(1)'
parse_default_wm='import sys,json; d=json.load(sys.stdin); c=d.get("content",""); print(c) if c else sys.exit(1)'

try_context() {
  target_space="$1"
  set -- context --source-app "$SOURCE_APP"
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
