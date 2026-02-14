---
name: save-thread
description: Save complete conversation as checkpoint. Only when user explicitly requests ("save session", "checkpoint this"). Use nmem t save to automatically import coding sessions.
---

# Save Thread

> Persist complete coding sessions to your personal knowledge base for future reference.

## When to Use

**Only activate when user explicitly says:**

- "Save this session"
- "Checkpoint this"
- "Record conversation"
- "Remember this session"

**Never auto-save or suggest saving.** This is always user-initiated.

## Prerequisites

**nmem CLI** - Choose one option:

**Option 1: uvx (Recommended)**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version
```

**Option 2: pip**
```bash
pip install nmem-cli
nmem --version
```

Ensure Nowledge Mem server is running at `http://localhost:14242`

## Usage

Use `nmem t save` to automatically import the current coding session:

```bash
# Save current session for current project
nmem t save --from claude-code

# Save with custom summary (recommended)
nmem t save --from claude-code -s "Brief summary of what was accomplished"

# Save all sessions for current project
nmem t save --from claude-code -m all

# Save for specific project path
nmem t save --from claude-code -p /path/to/project
```

### Available Options

| Flag | Description | Example |
|------|-------------|---------|
| `--from` | Source app | `--from claude-code` |
| `-s, --summary` | Brief summary | `-s "Fixed auth bug"` |
| `-m, --mode` | `current` or `all` | `-m all` |
| `-p, --project` | Project path | `-p /path/to/project` |
| `--truncate` | Truncate large results | `--truncate` |

### Behavior

- **Auto-detects sessions** from `~/.claude/projects/`
- **Idempotent**: Re-running appends only new messages
- **Thread ID**: Auto-generated as `claude-code-{session_id}`

## Thread vs Memory

| Thread | Memory |
|--------|--------|
| Full conversation history | Distilled insights |
| Complete context | Atomic, searchable facts |
| Session checkpoint | Actionable knowledge |

Both serve different purposes - you can save a thread AND distill key memories.

## Response Format

After successful save:

```
✓ Thread saved
Summary: {summary}
Messages: {count}
Thread ID: claude-code-{session_id}
```

## Examples

```bash
# Basic save
nmem t save --from claude-code

# Save with descriptive summary
nmem t save --from claude-code -s "Implemented JWT authentication with refresh tokens"

# Save all sessions
nmem t save --from claude-code -m all

# Save specific project
nmem t save --from claude-code -p ~/projects/my-app -s "API refactoring complete"
```

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Nowledge Mem](https://mem.nowledge.co)
- [Discord Community](https://nowled.ge/discord)
