---
description: Load your daily Working Memory briefing for session context
---

Load the user's Working Memory briefing before continuing.

## Workflow

Use:

```bash
nmem --json wm read
```

If the command succeeds but reports `exists: false`, say there is no Working Memory briefing yet.

Only if `nmem` is unavailable in an older local-only setup, fall back to:

```bash
cat ~/ai-now/memory.md
```

Then summarize the user's active focus areas, priorities, unresolved flags, and the most relevant recent changes when a briefing is actually present.

If remote access is configured through `~/.nowledge-mem/config.json`, let `nmem` use it naturally.
