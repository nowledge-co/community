---
name: search-memory
description: Search the user's personal knowledge base when past insights would improve the response. Trigger proactively for continuity, recurring bugs, design rationale, and remembered workflows.
---

# Search Memory

Use Nowledge Mem proactively when prior knowledge would materially improve the answer.

## Strong Triggers

Search when:

- the user references previous work, a prior fix, or an earlier decision
- the task resumes a named feature, bug, refactor, incident, or subsystem
- a debugging pattern resembles something solved earlier
- the user asks for rationale, preferences, procedures, or recurring workflow details
- the current result is ambiguous and past context would make the answer sharper

## Retrieval Routing

1. Start with `nmem --json m search` for durable knowledge.
2. Use `--mode deep` when the first pass is weak or the recall need is conceptual.
3. Use `nmem --json t search` for prior discussions, previous sessions, or exact conversation history.
4. If a memory result includes a `source_thread` or thread search returns a strong hit, inspect the conversation progressively with `nmem --json t show`.
5. Prefer the smallest retrieval surface that answers the question.

Mention source threads when they add useful historical context.
