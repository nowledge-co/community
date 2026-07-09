---
description: Sync recent Kimi Code sessions into Nowledge Mem Threads.
---

Sync Kimi Code work into Nowledge Mem.

If `nmem` exists but rejects `t sync --from kimi-code`, stop and report that the CLI is outdated. Ask the user to refresh the same CLI source first: desktop-bundled CLI via Mem Settings -> Preferences -> Developer Tools -> Install bundled CLI, PyPI via `python3 -m pip install --user --upgrade nmem-cli`, or pipx via `pipx upgrade nmem-cli`. Then retry the sync.

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
