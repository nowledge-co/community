---
description: Distill durable insights from this conversation into memories
---

# Distill Memory

Analyze the conversation and save only durable, reusable knowledge.

## Command

```bash
nmem --json m add "Content with enough context to stand on its own" \
  -t "Searchable title" \
  -i 0.8 \
  -s droid
```

## Quality Rules

- Save one durable insight per memory
- Focus on decisions, lessons, procedures, and high-value facts
- Do not store routine chatter or transcript fragments
- If the same memory already exists and the new information refines it, use `nmem m update`
