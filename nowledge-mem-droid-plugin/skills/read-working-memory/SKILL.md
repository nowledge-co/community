---
name: read-working-memory
description: Read your daily Working Memory briefing to understand current context. Load it near session start for cross-tool continuity, then reuse that context instead of re-reading it repeatedly.
---

# Read Working Memory

> Start each Droid session with context. Your Working Memory is a daily briefing synthesized from your knowledge base.

## When to Use

Use this near session start, resume, clear, or when the user asks about recent priorities.

Skip when:

- you already loaded it this session
- the user explicitly wants a fresh start
- the task is clearly isolated and context-independent

## Usage

Read Working Memory via `nmem`:

```bash
nmem wm read
```

Fallback for older local-only setups:

```bash
cat ~/ai-now/memory.md
```

## Response Contract

- Read once, then reuse the context mentally
- Reference only the parts relevant to the current task
- Do not overwhelm the user with the full briefing unless they asked for it
