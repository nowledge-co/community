---
description: Backfill older CodeBuddy sessions into Nowledge Mem Threads.
---

Preview first:

```bash
nmem t sync --from codebuddy --limit 20
```

Import after confirmation:

```bash
nmem t sync --from codebuddy --apply
```

For a custom root or one transcript:

```bash
CODEBUDDY_CONFIG_DIR="$HOME/.my-codebuddy-config" nmem t sync --from codebuddy --apply
nmem t sync --from codebuddy --session-dir /path/to/session.jsonl --all-projects --apply
```

The CLI reads local CodeBuddy transcripts and uploads normalized threads to the configured Mem server.
