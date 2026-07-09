---
description: Backfill older WorkBuddy/CodeBuddy sessions into Nowledge Mem Threads.
---

Backfill older WorkBuddy/CodeBuddy sessions deliberately.

Preview first:

```bash
nmem t sync --from workbuddy --limit 20
```

If the preview looks right, import:

```bash
nmem t sync --from workbuddy --apply
```

For a custom WorkBuddy/CodeBuddy config directory:

```bash
WORKBUDDY_CONFIG_DIR="$HOME/.my-workbuddy-config" nmem t sync --from workbuddy --apply
```

For a specific transcript file:

```bash
nmem t sync --from workbuddy --session-dir /path/to/session.jsonl --all-projects --apply
```

This reads local WorkBuddy transcripts; use `--from codebuddy` and `CODEBUDDY_CONFIG_DIR` for CodeBuddy transcripts and uploads normalized threads to the Mem server configured in `nmem`.
