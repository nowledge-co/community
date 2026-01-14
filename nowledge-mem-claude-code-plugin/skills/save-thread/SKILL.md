---
name: Save Thread
description: Save complete conversation as checkpoint. Only when user explicitly requests ("save session", "checkpoint this"). Use nmem t save to automatically import Claude Code sessions.
---

# Save Thread

## When to Save

**Only when user explicitly says:**
"Save this session" | "Checkpoint this" | "Record conversation"

Never auto-save or suggest.

## Tool Usage

Use `nmem t save` to automatically import the current Claude Code session:

```bash
# Save current session for current project
nmem t save --from claude-code

# Save with custom summary
nmem t save --from claude-code -s "Brief summary of what was accomplished"

# Save all sessions for current project
nmem t save --from claude-code -m all

# Save for specific project path
nmem t save --from claude-code -p /path/to/project
```

**Options:**
- `--from`: Source app (`claude-code` for Claude Code)
- `-s, --summary`: Optional brief summary (recommended)
- `-m, --mode`: `current` (default, latest session) or `all` (all sessions)
- `-p, --project`: Project directory path (defaults to current directory)
- `--truncate`: Truncate large tool results (>10KB)

**Behavior:**
- Auto-detects sessions from `~/.claude/projects/`
- Idempotent: Re-running appends only new messages
- Thread ID: Auto-generated as `claude-code-{session_id}`

## Thread vs Memory

Thread = full history | Memory = distilled insights (different purposes, can do both)

## Response

```
✓ Thread saved
Summary: {summary}
Messages: {count}
Thread ID: claude-code-{session_id}
```

## Troubleshooting

If `nmem` is not available:

**Option 1 (Recommended): Use uvx**
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run nmem (no installation needed)
uvx --from nmem-cli nmem t save --from claude-code
```

**Option 2: Install with pip**
```bash
pip install nmem-cli
nmem t save --from claude-code
```
