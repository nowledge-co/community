---
description: Save current session to Nowledge Mem
---

# Save Session

Save the current Claude Code or Grok Build session to Nowledge Mem using the nmem CLI.

## Usage

Run the command for your current host:

```bash
nmem t save --from claude-code
# In Grok Build:
nmem t save --from grok
```

## Options

Add a summary describing what was accomplished:

```bash
nmem t save --from claude-code -s "Brief summary of the session"
# In Grok Build:
nmem t save --from grok -s "Brief summary of the session"
```

Save all sessions for the current project:

```bash
nmem t save --from claude-code -m all
# In Grok Build:
nmem t save --from grok -m all
```

## Output

The command will:
- Auto-detect the current project from `~/.claude/projects/` or Grok Build's `~/.grok/sessions/`
- Import all messages from the session
- Return the thread ID for reference

**Note:** This operation is idempotent - running it multiple times will only append new messages.
