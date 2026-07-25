---
name: save-thread
description: Save the current Codex session so the user can find it later or resume from another tool. Trigger only when the user explicitly asks to save or preserve this conversation.
---

Save the actual Codex session transcript, not a summary, so it can be searched, resumed, or referenced from any connected tool.

MCP retrieval and memory-write tools do not replace this path. Real Codex thread import still goes through `nmem t save --from codex`.

## Command

Run the platform-specific packaged runner under `scripts/`, resolving that path
relative to this `SKILL.md` as required by Codex's skill rules. The runner
locates the installed desktop or standalone CLI even when Codex Desktop uses a
controlled PATH. Do not add a Python or Node launcher; those commands can be
absent from the same controlled PATH.

On macOS and Linux:

```bash
"<skill-dir>/scripts/save_thread.sh" --json t save --from codex -p . -s "Brief summary of what was accomplished"
```

On Windows PowerShell:

```powershell
& "<skill-dir>\scripts\save_thread.ps1" --json t save --from codex -p . -s "Brief summary of what was accomplished"
```

## Workflow

1. Write a concise 1-2 sentence summary of what was accomplished.
2. Replace `<skill-dir>` with the absolute directory containing this `SKILL.md`,
   then run the platform-appropriate command above.
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
