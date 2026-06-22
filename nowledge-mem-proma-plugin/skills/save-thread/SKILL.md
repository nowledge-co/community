---
name: save-thread
description: Save or archive the current Proma session to Nowledge Mem when the user explicitly asks, especially as a fallback when automatic hooks are unavailable.
---

# Save Thread

Save the current Proma session to Nowledge Mem on explicit user request.

## When to Save

**Save only when the user explicitly requests it:**
- "Save this session"
- "Archive this conversation"
- "Record this"
- "Checkpoint this"

The `UserPromptSubmit` and `Stop` hooks in `~/.proma/sdk-config/.claude/settings.json` handle automatic capture. This skill is for manual saves and for fallback when hooks are not configured.

## Usage

**Primary (MCP)**:
```
mcp__nowledge-mem__save_thread
  session_id: "<current session id>"
  title: "<optional custom title>"
```

**Manual script (if MCP unavailable)**:
```bash
echo '{"session_id":"<id>","cwd":"<project dir>"}' | python3 ~/.proma/scripts/save-to-nmem.py
```

## Behavior

- Proma sessions are stored as JSONL in `~/.proma/sdk-config/projects/<workspace-hash>/<session-id>.jsonl`
- Older Proma builds that write `~/.proma/agent-sessions/<id>.jsonl` are still supported by the script
- The save script deduplicates by UUID and extracts text from content blocks
- Thread ID format: `proma-{session_id}`
- Re-running is idempotent — only new messages are appended

## Thread vs Memory

Thread = real session messages (for searching conversation history)
Memory = distilled insights (for durable knowledge)
Both are useful — save a thread AND distill key learnings.

## Troubleshooting

If thread save fails, check `~/.proma/logs/nm-hooks.log` for errors. Verify the nmem server is running with `nmem status`.
