---
name: save-handoff
description: Save a resumable handoff summary only when the user explicitly asks. This is not a real transcript import.
---

# Save Handoff

Use this only when the user explicitly asks for a checkpoint, resumable summary, or handoff.

Cursor does not yet have a first-class Nowledge live session importer in this plugin, so do not claim a real thread save.

When `nmem` is available, create a structured handoff summary through the terminal:

```bash
nmem --json t create -t "Cursor Session - <topic>" -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." -s cursor
```

If `nmem` is unavailable, explain that plainly instead of pretending the handoff was saved.
