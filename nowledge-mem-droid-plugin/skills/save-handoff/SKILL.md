---
name: save-handoff
description: Save a concise Droid handoff summary only when the user explicitly asks. This is intentionally separate from full thread-save, which does not exist yet for Droid.
---

# Save Handoff

Only use this skill when the user explicitly asks to save progress as a handoff, leave a resumable summary, or create a lightweight restart point.

## Why This Is A Handoff

`save-thread` should mean saving the real session messages through a native runtime importer.

For Droid, that importer does not exist yet. This skill intentionally creates a structured handoff summary thread instead of pretending to import the full session.

## Workflow

1. Write a short but useful handoff summary.
2. Include Goal, Decisions, Files, Risks, and Next.
3. Create a thread with `nmem --json t create` and `-s droid`.

Example:

```bash
nmem --json t create -t "Session Handoff - auth refactor" -c "Goal: finish the auth refactor. Decisions: keep refresh verification in the API layer. Files: api/auth.ts, auth.test.ts. Risks: remote expiry behavior still needs validation. Next: verify remote session expiry end to end." -s droid
```

Never present this as a lossless thread save. Never auto-save without an explicit user request.
