---
description: Check Nowledge Mem connectivity from CodeBuddy.
---

Run:

```bash
nmem --json status
nmem --json config mcp show --host codebuddy
nmem --json t sync --from codebuddy --limit 1
```

If status works but a CodeBuddy command is rejected, update the CLI from the same source and retry.
