---
description: Backfill older WorkBuddy sessions into Nowledge Mem Threads.
---

Preview before importing:

```bash
nmem t sync --from workbuddy --limit 20
```

Import after the preview is confirmed:

```bash
nmem t sync --from workbuddy --apply
```

For a custom WorkBuddy config directory:

```bash
WORKBUDDY_CONFIG_DIR="$HOME/.my-workbuddy-config" nmem t sync --from workbuddy --apply
```

For one transcript:

```bash
nmem t sync --from workbuddy --session-dir /path/to/session.jsonl --all-projects --apply
```

The CLI reads local WorkBuddy transcripts and uploads normalized threads to the configured Mem server.
