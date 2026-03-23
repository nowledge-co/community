---
name: distill-memory
description: Recognize breakthrough moments, design decisions, and durable lessons worth preserving. Distill only high-signal knowledge that should remain useful after the session ends.
---

# Distill Memory

## Proactive Save

Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.

## Good Candidates

- a debugging breakthrough
- a design decision with rationale
- a research conclusion
- an unexpected lesson or preventive measure
- plans that future sessions will need to resume

Skip routine fixes, work in progress without a stable takeaway, and generic Q&A.

## Tool Usage

Create memories with `nmem`:

```bash
nmem --json m add "Insight with enough context to stand on its own" \
  -t "Searchable title" \
  -i 0.8 \
  -s droid
```

If the same decision or workflow already exists and the new information refines it, update the memory instead of duplicating it:

```bash
nmem m update <id> -t "Updated title"
```

## Quality Bar

- Atomic
- Actionable
- Understandable without the original conversation
- Focused on the outcome, not the chat transcript
