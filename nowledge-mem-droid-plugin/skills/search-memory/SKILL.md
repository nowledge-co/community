---
name: search-memory
description: Search memory and thread history when past knowledge would materially improve the answer. Route between distilled memories and prior discussions instead of treating them as separate silos.
---

# Search Memory

## When to Search

**Strong signals — search when:**

- the current task connects to prior work
- the bug or design resembles something solved earlier
- the task is a review, regression, release, docs-alignment, or connector-behavior question
- the user asks why a decision was made
- a previous discussion or session likely contains the missing context
- the user uses implicit recall language: "that approach", "like before"

**Contextual signals — consider searching when:**

- complex debugging where prior context would narrow the search space
- architecture discussion that may intersect with past decisions
- domain-specific conventions the user has established before

**Skip when:**

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

If a memory result includes `source_thread`, or thread search identifies the likely discussion, fetch once for the specific messages needed:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase `--offset` only when more messages are actually needed.

## Response Contract

- Be explicit when you relied on recalled knowledge
- Prefer the smallest retrieval surface that answers the question
- Suggest distillation only if the current discussion produced new durable knowledge
- For continuation-heavy engineering work, search near the start of the task rather than waiting for an explicit recall request

### Bounded thread reads

Search memories or threads first, then choose the specific conversation and message range needed. Call `thread_fetch_messages`, a host thread-fetch tool, or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.
