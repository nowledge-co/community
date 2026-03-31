---
name: save-thread
description: Save the current Codex session as a real thread import into Nowledge Mem. Uses nmem CLI. Trigger when the user asks to save or preserve this conversation, or at the end of a significant work session.
---

Import the real Codex session transcript into Nowledge Mem as a thread.

## Command

```bash
nmem --json t save --from codex -p . -s "Brief summary of what was accomplished"
```

## Workflow

1. Write a concise 1-2 sentence summary of what was accomplished.
2. Run the save command.
3. Report whether the thread was created or updated, how many messages were stored, and the thread ID.

## Options

- Specific session: `--session-id <id>`

## Important

This is a **real session import** — it captures the actual Codex transcript, not a summary. The `-s` flag adds searchable metadata, but the full conversation is preserved.

Do not replace this with `nmem t create`. Do not fabricate a transcript.

## When to use

- User explicitly asks to save the session.
- Do NOT auto-save without the user's request.

## Links

- [Thread documentation](https://mem.nowledge.co/docs/features/threads)
