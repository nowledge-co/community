---
description: Sync the current or most recent WorkBuddy session into Nowledge Mem Threads.
---

Preview the most recent WorkBuddy session:

```bash
nmem --json t sync --from workbuddy --limit 1
```

If the preview is correct, import it:

```bash
nmem --json t sync --from workbuddy --limit 1 --apply
```

If the user supplied a session id in `$ARGUMENTS`, use:

```bash
nmem --json t sync --from workbuddy --session-id "$ARGUMENTS" --apply
```

Summarize the thread id and whether Mem created or updated the thread. Real transcript import uses the local `nmem` CLI because MCP cannot read WorkBuddy session files.
