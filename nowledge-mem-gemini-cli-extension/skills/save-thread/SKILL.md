---
name: save-thread
description: Save the real Gemini CLI session to Nowledge Mem only when the user explicitly asks. This uses Gemini's native transcript-backed importer rather than a summary-only fallback.
---

# Save Thread

Only use this skill when the user explicitly asks to save the session, persist the thread, or store the actual Gemini conversation.

## Contract

`save-thread` means saving the real Gemini session messages.

Use `nmem t save --from gemini-cli` for that path. A short summary may be attached as metadata, but the stored thread should come from Gemini's recorded transcript.

Use `save-handoff` instead only when the user wants a lightweight resumable summary rather than the full session.

## Workflow

1. Write a concise 1-2 sentence summary.
2. Run `nmem --json t save --from gemini-cli -p . -s "..."`.
3. If the user names a different Gemini session, add `--session-id`.
4. Report whether the thread was created or appended and how many messages were stored.

Example:

```bash
nmem --json t save --from gemini-cli -p . -s "Finished the auth refactor and verified the new refresh-token flow."
```

Never claim a checkpoint summary is a thread save. Never auto-save without an explicit user request.
