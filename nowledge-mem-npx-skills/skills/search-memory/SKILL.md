---
name: search-memory
description: Search your personal knowledge base when past insights would improve response. Recognize when stored breakthroughs, decisions, or solutions are relevant. Search proactively based on context, not just explicit requests.
---

# Search Memory

> AI-powered search across your personal knowledge base using Nowledge Mem.

## When to Use

Search when:

- the user references previous work, a prior fix, or an earlier decision
- the task resumes a named feature, bug, refactor, incident, or subsystem
- a debugging pattern resembles something solved earlier
- the user asks for rationale, preferences, procedures, or recurring workflow details
- the current result is ambiguous and past context would make the answer sharper

## Retrieval Routing

1. Start with `nmem --json m search` for durable knowledge.
2. Use `nmem --json t search` when the user is really asking about a prior conversation or exact session history.
3. If a result includes `source_thread`, inspect it progressively with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.
4. Prefer the smallest retrieval surface that answers the question.
