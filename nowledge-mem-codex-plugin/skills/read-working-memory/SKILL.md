---
name: read-working-memory
description: Read the user's Working Memory briefing at the start of a session or when the user asks for current context, focus areas, or priorities. Uses nmem CLI. Trigger at session start, when resuming a project after a break, or when the user asks "what am I working on".
---

Load the user's Working Memory briefing for current focus areas, priorities, and recent knowledge changes.

## Command

```bash
nmem --json wm read
```

## What You'll Find

- **Active Focus Areas** — Topics currently engaged with, ranked by recent activity
- **Priorities** — Items flagged as important or needing attention
- **Unresolved Flags** — Contradictions, stale information, or items needing verification
- **Recent Activity** — What changed in your knowledge base since the last briefing
- **Deep Links** — References to specific memories for further exploration

## Interpretation

- If Working Memory has content, summarize key focus areas and any unresolved flags briefly (2-3 sentences), then proceed informed by this context.
- If `exists: false` or the command fails, say there is no briefing yet and continue normally.
- Reference naturally — share only the parts relevant to what the user is working on.

## When to use

**At session start:**

- Beginning of a new conversation
- Returning to a project after a break
- When context about recent work would help

**During session:**

- User asks "what am I working on?" or "what's my context?"
- User references recent priorities or decisions

**Skip when:**

- Already loaded this session — do not re-read unless the user asks
- User explicitly wants a fresh start
- Working on an isolated, context-independent task

## Cross-tool continuity

Working Memory is shared across all connected AI tools — insights saved in any agent appear in the same briefing. Updated daily by Background Intelligence.

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Working Memory guide](https://mem.nowledge.co/docs/features/working-memory)
