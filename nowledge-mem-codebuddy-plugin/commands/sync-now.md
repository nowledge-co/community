---
description: Sync the current or most recent WorkBuddy or CodeBuddy session into Nowledge Mem Threads.
---

Sync WorkBuddy work into Nowledge Mem.

First preview:

```bash
nmem --json t sync --from workbuddy --limit 1
```

If the preview shows the current or most recent WorkBuddy session, import it:

```bash
nmem --json t sync --from workbuddy --limit 1 --apply
```

If the user provided a specific session id in `$ARGUMENTS`, use it instead:

```bash
nmem --json t sync --from workbuddy --session-id "$ARGUMENTS" --apply
```

For CodeBuddy Code, use `--from codebuddy` instead.

Summarize the thread id and whether Mem created or updated the thread. Do not treat MCP as the transcript import path; use the local `nmem` CLI because it can read WorkBuddy or CodeBuddy session files.
