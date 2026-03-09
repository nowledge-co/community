---
description: Save the real current Codex session to Nowledge Mem
---

Save the real Codex session to Nowledge Mem with `nmem t save`.

## Basic Usage

```bash
# Save current session from the current project
nmem --json t save --from codex -p .

# Save with a short summary
nmem --json t save --from codex -p . -s "Brief summary of what we accomplished"
```

## Workflow

1. Write a concise 1-2 sentence summary of what was accomplished.
2. Save the session with:

```bash
nmem --json t save --from codex -p . -s "Your summary here"
```

3. Report whether the thread was created or updated, how many messages were stored, and the thread id.

## Advanced Options

```bash
# Save a specific session by ID
nmem --json t save --from codex -p . --session-id <session-id> -s "Summary"

# Save all sessions for the current project
nmem --json t save --from codex -p . -m all
```

This is a real session import. Do not replace it with `t create`.
