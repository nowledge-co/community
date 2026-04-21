---
name: save-thread
description: Save the current Codex session so the user can find it later or resume from another tool. Trigger only when the user explicitly asks to save or preserve this conversation.
---

Save the actual Codex session transcript, not a summary, so it can be searched, resumed, or referenced from any connected tool.

MCP retrieval and memory-write tools do not replace this path. Real Codex thread import still goes through `nmem t save --from codex`.

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

This is a **real session import**. It captures the actual Codex transcript, not a summary. The `-s` flag adds searchable metadata; the full conversation is preserved.

Do not replace this with `nmem t create`. Do not fabricate a transcript.

## When to use

- User explicitly asks to save the session.
- Do NOT auto-save without the user's request.

## Links

- [Threads](https://mem.nowledge.co/docs/threads)
