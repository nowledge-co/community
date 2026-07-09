---
description: Sync recent Kimi Code sessions into Nowledge Mem Threads.
---

Sync Kimi Code work into Nowledge Mem.

First run:

```bash
nmem --json t sync --from kimi-code --limit 1
```

If the preview shows the current or most recent Kimi Code session, import it:

```bash
nmem --json t sync --from kimi-code --limit 1 --apply
```

If the user provided a specific session id in `$ARGUMENTS`, use it instead:

```bash
nmem --json t sync --from kimi-code --session-id "$ARGUMENTS" --apply
```

Summarize the thread id and whether Mem created or updated the thread. Do not treat MCP as the transcript import path; use the local `nmem` CLI because it can read Kimi Code's session files.
