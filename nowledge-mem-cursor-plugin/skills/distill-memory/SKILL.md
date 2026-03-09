---
name: distill-memory
description: Capture durable decisions, lessons, and procedures from Cursor work into atomic memories.
---

# Distill Memory

Capture only durable knowledge that should remain useful after the current session ends.

## When To Save

Use memory storage for:

- decisions with rationale
- repeatable procedures
- lessons from debugging or incident work
- durable preferences or constraints

## Add vs Update

- Use `memory_add` when the insight is genuinely new.
- If recall already surfaced the same decision, workflow, or preference and the new information refines it, use `memory_update` instead of creating a duplicate.

Prefer atomic, standalone memories with strong titles and clear meaning. Focus on what was learned or decided, not routine chatter.
