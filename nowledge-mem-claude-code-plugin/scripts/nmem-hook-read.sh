#!/bin/sh
# Keep the raw-output entry point for subagents and older hook callers.

case "${CLAUDE_PLUGIN_ROOT:-}" in
  */.grok/*|*\\.grok\\*|*/.grok) exit 0 ;;
esac
if [ -n "${GROK_SESSION_ID:-}${GROK_HOOK_EVENT:-}${GROK_WORKSPACE_ROOT:-}${GROK_PLUGIN_ROOT:-}" ]; then
  exit 0
fi

PY="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"
SCRIPT="${0%/*}/nmem-hook-context.py"
if [ -n "$PY" ] && [ -f "$SCRIPT" ]; then
  if [ "${1:-}" = "--hook" ]; then
    shift
    exec "$PY" "$SCRIPT" "$@"
  fi
  exec "$PY" "$SCRIPT" --raw "$@"
fi

case " $* " in
  *" --event UserPromptSubmit "*)
    printf '%s\n' '[Nowledge Mem] For continuation, review, regression, release, connector, prior-decision, or exact-history work, run one targeted nmem memory or thread search before concluding. Startup briefing is not a substitute. If retrieval fails, say so briefly.'
    exit 0
    ;;
esac
if [ "${1:-}" = "--hook" ]; then
  printf '%s\n' '{"systemMessage":"[Nowledge Mem] Python is unavailable. Check /nowledge-mem:status.","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"[Nowledge Mem] For continuation or prior-decision work, run one targeted nmem memory or thread search before concluding. If context was compacted, save durable insights before continuing."}}'
  exit 0
fi
# Only raw-output callers in the unconfigured Default lane can use the legacy file.
case "${NMEM_SPACE:-${NMEM_SPACE_ID:-default}}" in
  default|"") ;;
  *) exit 0 ;;
esac
if [ -n "${NMEM_AGENT_ID:-}${NMEM_HOST_AGENT_ID:-}${NMEM_APP_DATA:-}${NMEM_APP_CONFIG_DIR:-}${NMEM_CLI_CONFIG_DIR:-}" ]; then
  exit 0
fi
[ -n "${NMEM_AI_NOW_HOME-$HOME/ai-now}" ] || exit 0
cat "${NMEM_AI_NOW_HOME-$HOME/ai-now}/memory.md" 2>/dev/null || true
