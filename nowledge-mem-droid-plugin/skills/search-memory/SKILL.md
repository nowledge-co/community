---
name: search-memory
description: Search memory and thread history when past knowledge would materially improve the answer. Route between distilled memories and prior discussions instead of treating them as separate silos.
---

# Search Memory

## When to Search

Search proactively when:

- the current task connects to prior work
- the bug or design resembles something solved earlier
- the user asks why a decision was made
- a previous discussion or session likely contains the missing context

Skip when:

- the task is fundamentally new
- the question is generic syntax or reference material
- the user explicitly wants a fresh perspective

## Tool Usage

Start with durable knowledge:

```bash
nmem --json m search "3-7 core concepts"
```

Use thread search when the user is really asking about a prior conversation:

```bash
nmem --json t search "query" --limit 5
```

If a memory result includes `source_thread`, or thread search identifies the likely discussion, fetch progressively:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase `--offset` only when more messages are actually needed.

## Response Contract

- Be explicit when you relied on recalled knowledge
- Prefer the smallest retrieval surface that answers the question
- Suggest distillation only if the current discussion produced new durable knowledge
