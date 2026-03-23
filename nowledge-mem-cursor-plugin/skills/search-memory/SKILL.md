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
3. If a memory result includes `source_thread_id`, or thread search finds the likely conversation, use `thread_fetch_messages` progressively.
4. Prefer the smallest retrieval surface that answers the question.

Avoid over-reading long conversations when one page of messages is enough.
