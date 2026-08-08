---
name: save-thread
description: Import the real current Cursor Agent transcript when the user explicitly asks or automatic stop-hook capture is unavailable.
---

# Save Thread

The bundled `stop` hook normally imports the current Cursor Agent transcript automatically when the local `nmem` CLI and Cursor transcript are available.

Use this skill only when:

- the user explicitly asks to save the current thread now
- the automatic hook is unavailable, disabled, or known to have failed
- a manual retry is needed after installing or reconnecting `nmem`

Run the real client-side transcript importer from the current project:

```bash
nmem --json t save --from cursor --project . --truncate
```

If the current Cursor conversation ID is known, prefer the exact session:

```bash
nmem --json t save --from cursor --project . --session-id "<conversation-id>" --truncate
```

Do not substitute a handoff summary for transcript import. Use `save-handoff` only when the user explicitly wants a concise resumable checkpoint.

If `nmem` or the local Cursor transcript is unavailable, report that limitation plainly and do not claim the thread was saved.
