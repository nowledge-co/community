---
name: distill-memory
description: Capture durable decisions, lessons, and procedures from Cursor work into atomic memories.
---

# Distill Memory

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked.

## When To Save

Good candidates:

- decisions with rationale
- repeatable procedures
- lessons from debugging or incident work
- durable preferences or constraints
- plans that future sessions will need to resume

Skip routine fixes, work in progress, simple Q&A, and generic information.

## Add vs Update

- Use `memory_add` when the insight is genuinely new.
- If recall already surfaced the same decision, workflow, or preference and the new information refines it, use `memory_update` instead of creating a duplicate.
- At the end of substantial work, explicitly review whether one durable memory should be added or updated.

Prefer atomic, standalone memories with strong titles and clear meaning. Focus on what was learned or decided, not routine chatter.

When saving directly, pass `unit_type` when you know it: `fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, or `event`.

## Where It Lands

In a Team workspace, a save with no named Space goes to your personal space ("Only me"). Read the destination Mem reports (`nmem m add` prints `Saved to <Space> (<id>)`; `memory_add` returns `space_label` and `share_hint`) instead of assuming who can see it.

To share, save with `--space "<name>"` (or `space_id`), using a name from `nmem spaces list` or `list_spaces`. Use a shared Space only when the user named it; never choose one from a repo, folder, or prompt text.
