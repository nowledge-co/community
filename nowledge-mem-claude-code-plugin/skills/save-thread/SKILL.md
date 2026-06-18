---
name: save-thread
description: Save the real Claude Code or Grok Build session messages only when the user explicitly requests it. Use nmem t save to import the recorded session, not a summary-only checkpoint.
---

# Save Thread

## When to Save

**Only when user explicitly says:**
"Save this session" | "Checkpoint this" | "Record conversation"

Never auto-save or suggest.

## Tool Usage

Use `nmem t save` to import the current session. Use `claude-code` in Claude Code and `grok` in Grok Build:

```bash
# Save current session for current project
nmem t save --from claude-code
# In Grok Build:
nmem t save --from grok

# Save with custom summary
nmem t save --from claude-code -s "Brief summary of what was accomplished"
# In Grok Build:
nmem t save --from grok -s "Brief summary of what was accomplished"

# Save all sessions for current project
nmem t save --from claude-code -m all
# In Grok Build:
nmem t save --from grok -m all

# Save for specific project path
nmem t save --from claude-code -p /path/to/project
# In Grok Build:
nmem t save --from grok -p /path/to/project
```

**Options:**
- `--from`: Source app (`claude-code` for Claude Code, `grok` for Grok Build)
- `-s, --summary`: Optional brief summary (recommended)
- `-m, --mode`: `current` (default, latest session) or `all` (all sessions)
- `-p, --project`: Project directory path (defaults to current directory)
- `--truncate`: Truncate large tool results (>10KB)

**Behavior:**
- Auto-detects sessions from `~/.claude/projects/` for Claude Code or `~/.grok/sessions/` for Grok Build
- Idempotent: Re-running appends only new messages
- Thread ID: Auto-generated as `claude-code-{session_id}` or `grok-{session_id}`

## Thread vs Memory

Thread = real session messages | Memory = distilled insights (different purposes, can do both)

## Response

```
✓ Thread saved
Summary: {summary}
Messages: {count}
Thread ID: claude-code-{session_id} or grok-{session_id}
```

## Troubleshooting

If `nmem` is not in PATH: `pip install nmem-cli`, or on Arch Linux `yay -S nmem-cli` / `paru -S nmem-cli`

For remote servers: run `nmem config client set url https://...` and `nmem config client set api-key ...` once on this machine.

Run `/status` to check server connection.
