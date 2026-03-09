---
name: save-handoff
description: Save a concise handoff summary only when the user explicitly requests it. Use this for resumable progress notes in generic agent environments where a real session importer is not guaranteed.
---

# Save Handoff

> Persist a compact resumable handoff when the user wants a restart point, summary, or checkpoint.

## When to Use

**Only activate when user explicitly says:**

- "Save a handoff"
- "Checkpoint this"
- "Leave me a summary"
- "Remember where we are"

**Never auto-save or suggest saving.** This is always user-initiated.

## Why This Is A Handoff

This reusable package works across many agents. It must not pretend to have a real transcript importer when the runtime may not provide one.

So this skill creates a structured handoff summary with `nmem t create` instead of claiming a lossless thread save.

If the user's tool has a dedicated Nowledge integration with real thread import, prefer that native package instead.

## Usage

Create a structured handoff thread:

```bash
nmem --json t create   -t "Session Handoff - <topic>"   -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..."   -s generic-agent
```

### Handoff Format

Include these fields:

- Goal
- Decisions
- Files
- Risks
- Next

### Response Format

After successful save:

```
✓ Handoff saved
Title: {title}
Summary: {content}
Thread ID: {thread_id}
```

Never present this as a real transcript import.
