---
description: Distill durable insights from the current Codex conversation into Nowledge Mem
---

Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.

## Workflow

1. Identify durable insights, decisions, lessons, procedures, or preferences from the conversation.
2. Skip routine chatter, unresolved half-ideas, and low-signal implementation noise.
3. If a memory likely already exists, search first instead of creating a duplicate.
4. Use `nmem --json m add` for each selected memory.
5. Use strong titles, a fitting `--unit-type`, and 0-3 labels only when they improve retrieval.
6. Set `-s codex` so the capture path stays auditable.

## Importance Guide

- `0.6-0.7`: useful but routine durable knowledge
- `0.8-0.9`: major lesson, decision, or breakthrough
- `1.0`: rare, foundational memory

## Example

```bash
nmem --json m add "JWT refresh failures came from gateway and API clock skew. Keep refresh verification in the API layer and validate expiry against remote sessions."   --title "JWT refresh failures traced to clock skew"   --importance 0.9   --unit-type learning   -l auth -l backend   -s codex
```

After saving, report what was stored, which unit types were used, and why each memory was worth keeping.
