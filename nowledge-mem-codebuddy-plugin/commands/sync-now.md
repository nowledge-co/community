---
description: Sync the current or most recent CodeBuddy session into Nowledge Mem Threads.
---

Preview, then import:

```bash
nmem --json t sync --from codebuddy --limit 1
nmem --json t sync --from codebuddy --limit 1 --apply
```

When `$ARGUMENTS` contains a session id:

```bash
nmem --json t sync --from codebuddy --session-id "$ARGUMENTS" --apply
```

Summarize the thread id and whether Mem created or updated it.
