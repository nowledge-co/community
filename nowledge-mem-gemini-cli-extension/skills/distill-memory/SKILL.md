---
name: distill-memory
description: Detect breakthrough moments, durable lessons, and decisions worth preserving. Suggest distillation sparingly, then store high-value knowledge as atomic memories.
---

# Distill Memory

Save knowledge that future you would be glad to find.

This Gemini integration is CLI-first. Use direct `nmem` commands rather than introducing extra layers.

## Worth Saving

- A debugging breakthrough
- A design or architecture decision with rationale
- A counterintuitive lesson
- A reusable procedure or workflow
- A preference that will matter again

## Not Worth Saving

- Routine edits
- Partial work with no conclusion
- Generic information
- Verbose transcripts

## Command

```bash
nmem --json m add "Insight with enough context to stand alone." -t "Searchable title" -i 0.8 --unit-type learning -l project-name -s gemini-cli
```

Use `decision`, `procedure`, `learning`, `preference`, or `plan` when that makes retrieval sharper than the default `fact`. Add labels only when they materially help future search.

## Quality Bar

- atomic, not multi-topic
- standalone, not dependent on the chat transcript
- focused on what was learned or decided
- clear enough to reuse months later
