---
name: read-working-memory
description: Load your current context at session start: what you were working on, active priorities, and unresolved flags. Also trigger when resuming after a break or when the user asks "what am I working on".
---

Start with what matters. Working Memory is a daily briefing of your active focus areas, priorities, and recent knowledge changes, kept up to date across every AI tool you use.

## Command

```bash
nmem --json wm read
```

## What you'll find

- **Focus areas**: what you're actively working on, ranked by recent activity
- **Priorities**: items flagged as important or needing attention
- **Unresolved flags**: contradictions, stale information, or items to verify
- **Recent changes**: what shifted in your knowledge base since the last briefing

## How to use it

- Summarize key focus areas and any unresolved flags briefly (2-3 sentences), then work informed by this context.
- If `exists: false` or the command fails, say there is no briefing yet and continue normally.
- Share only the parts relevant to what the user is doing now.

## When to read

- Beginning of a new session
- Returning to a project after a break
- User asks "what am I working on?" or "what's my context?"

## When to skip

- Already loaded this session (do not re-read unless the user asks)
- User explicitly wants a fresh start
- Task is isolated and needs no prior context

## Links

- [Working Memory](https://mem.nowledge.co/docs/features/working-memory)
- [Getting started](https://mem.nowledge.co/docs)
