---
name: save-handoff
description: Save a concise Gemini CLI handoff summary only when the user explicitly asks. This is intentionally separate from full thread-save, which should use the native Gemini session importer.
---

# Save Handoff

Only use this skill when the user explicitly asks to save progress as a handoff, leave a resumable summary, or create a lightweight restart point.

## Why This Is A Handoff

`save-thread` should mean saving the real session messages through the native Gemini importer.

For Gemini, this skill intentionally creates a structured handoff summary thread instead of importing the full session.

## Workflow

1. Write a short but useful handoff summary.
2. Include Goal, Decisions, Files, Risks, and Next.
3. Create a thread with `nmem t create` and `-s gemini-cli`.
4. If the user wants the full session instead, use `save-thread`.

Example:

```bash
nmem --json t create -t "Gemini CLI Session - auth refactor" -c "Goal: finish the auth refactor. Decisions: keep refresh verification in the API layer and treat gateway clock skew as the root cause. Files: api/auth.ts, auth.test.ts. Risks: expiry behavior may still differ in remote sessions. Next: validate remote session expiry end to end." -s gemini-cli
```

Never present this as a lossless thread save. Never auto-save without an explicit user request.
