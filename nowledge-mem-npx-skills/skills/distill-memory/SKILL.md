---
name: distill-memory
description: Capture breakthrough moments and valuable insights as searchable memories in your knowledge base.
---

# Distill Memory

Store only knowledge that should remain useful after the current session ends.

## When to Save

Good candidates include:

- decisions with rationale
- repeatable procedures
- lessons from debugging or incident work
- durable preferences or constraints
- plans that future sessions will need to resume cleanly

## Add vs Update

- Use `nmem --json m add` when the insight is genuinely new.
- If an existing memory already captures the same decision, workflow, or preference and the new information refines it, use `nmem m update <id> ...` instead of creating a duplicate.

Prefer atomic, standalone memories with strong titles and clear meaning. Focus on what was learned or decided, not routine chatter.
