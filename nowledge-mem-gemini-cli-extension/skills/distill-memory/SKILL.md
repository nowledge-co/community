---
name: distill-memory
description: Detect breakthrough moments, durable lessons, and decisions worth preserving. Suggest distillation sparingly, then store high-value knowledge as atomic memories.
---

# Distill Memory

Store only knowledge that should remain useful after the current session ends.

## Good Candidates

- decisions with rationale
- repeatable procedures
- lessons from debugging or incident work
- durable preferences or constraints
- plans that future sessions will need to resume cleanly

## Add vs Update

- Use `nmem --json m add` when the insight is genuinely new.
- If an existing memory already captures the same decision, workflow, or preference and the new information refines it, use `nmem m update <id> ...` instead of creating a duplicate.

Prefer atomic, standalone memories with strong titles and structured meaning. Focus on what was learned or decided, not routine chatter.
