# Save Thread

Save the current Proma session to Nowledge Mem on explicit user request.

## When to Save

**Save only when the user explicitly requests it:**
- "Save this session"
- "Archive this conversation"
- "Record this"
- "Checkpoint this"

The Stop hook in `~/.proma/settings.json` handles automatic capture after every response. This skill is for manual saves and for fallback when hooks are not configured.

## Usage

**Primary (MCP)**:
```
mcp__nowledge-mem__save_thread
  session_id: "<current session id>"
  title: "<optional custom title>"
```

**Manual script (if MCP unavailable)**:
```bash
echo '{"session_id":"<id>","cwd":"<project dir>"}' | python ~/.proma/hooks/save-to-nmem.py
```

**CLI import (for Proma sessions already on disk)**:
```bash
nmem t save --from proma --project /path/to/project
```

## Behavior

- Proma sessions are stored as JSONL in `~/.proma/agent-sessions/<id>.jsonl`
- The save script deduplicates by UUID and extracts text from content blocks
- Thread ID format: `proma-{session_id}`
- Re-running is idempotent — only new messages are appended

## Thread vs Memory

Thread = real session messages (for searching conversation history)
Memory = distilled insights (for durable knowledge)
Both are useful — save a thread AND distill key learnings.

## Troubleshooting

If thread save fails, check `~/.proma/log/nmem-hook.log` for errors. Verify the nmem server is running with `nmem status`.
