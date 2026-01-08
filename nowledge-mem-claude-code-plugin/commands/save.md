---
description: Save current session to Nowledge Mem
---

# Save Session

Save the current Claude Code session to Nowledge Mem using the nmem CLI.

## Usage

Run this command to save the current session:

```bash
nmem t save --from claude-code
```

## Options

Add a summary describing what was accomplished:

```bash
nmem t save --from claude-code -s "Brief summary of the session"
```

Save all sessions for the current project:

```bash
nmem t save --from claude-code -m all
```

## Output

The command will:
- Auto-detect the current project from `~/.claude/projects/`
- Import all messages from the session
- Return the thread ID for reference

**Note:** This operation is idempotent - running it multiple times will only append new messages.
