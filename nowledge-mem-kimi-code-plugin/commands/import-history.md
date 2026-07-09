---
description: Preview and import older Kimi Code conversations into Nowledge Mem.
---

Help the user backfill older Kimi Code sessions into Nowledge Mem.

Preview first:

```bash
nmem t sync --from kimi-code --limit 20
```

If the user confirms the preview is right, import:

```bash
nmem t sync --from kimi-code --apply
```

If the user asked for all local sessions explicitly, use `--all-projects`. If they asked for a specific project, use `-p /path/to/project`. Explain that reruns are safe because Kimi session ids and message ids are stable.
