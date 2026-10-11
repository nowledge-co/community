---
name: search-memory
description: Route recall across memories and threads when past work would improve the response.
---

# Search Memory

Use Nowledge Mem proactively when prior knowledge would materially improve the answer.

## Strong Triggers

Search when:

- the user references previous work, a prior fix, or an earlier decision
- the task resumes a named feature, bug, refactor, incident, or subsystem
- the task is a review, regression, release, docs-alignment, or connector-behavior question
- a debugging pattern resembles something solved earlier
- the user asks for rationale, preferences, procedures, or "how we usually do this"
- the user uses implicit recall language: "that approach", "like before"

**Contextual signals — consider searching when:**

- complex debugging where prior context would narrow the search space
- architecture discussion that may intersect with past decisions
- domain-specific conventions the user has established before

## Retrieval Routing

1. Start with `memory_search` for durable knowledge.
2. Use `thread_search` for prior discussions, previous sessions, or exact conversation history.
3. If a memory result includes `source_thread_id`, or thread search finds the likely conversation, use `thread_fetch_messages` once for the specific messages needed.
4. Prefer the smallest retrieval surface that answers the question.

Avoid over-reading long conversations when one page of messages is enough.

For continuation-heavy engineering work, search near the start of the task rather than waiting for an explicit recall request.

### Bounded thread reads

Search memories or threads first, then choose the specific conversation and message range needed. Call `thread_fetch_messages`, a host thread-fetch tool, or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.
