---
name: search-memory
description: Search past decisions, procedures, learnings, or context relevant to the current task. Trigger when work connects to prior decisions, a debugging pattern resembles a past issue, the user asks about rationale, or uses recall language like "that approach" or "like before".
---

Find what the user already knows. Search their memories and past conversations for decisions, procedures, and context that make the current task sharper.

## When to use

**Strong signals — search when:**

- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, incident, or subsystem
- A debugging pattern resembles something solved earlier
- The user asks for rationale, preferences, procedures, or recurring workflow details
- The user uses implicit recall language: "that approach", "like before", "the pattern we used"

**Contextual signals — consider searching when:**

- Complex debugging where prior context would narrow the search space
- Architecture discussion that may intersect with past decisions
- Domain-specific conventions the user has established before
- The current result is ambiguous and past context would make the answer sharper

**When NOT to search:**

- Fundamentally new topic with no prior history
- Generic syntax or API questions answerable from documentation
- User explicitly asks for a fresh perspective without prior context

## Retrieval routing

1. Start with `nmem --json m search "query"` for durable knowledge (decisions, insights, procedures).
2. Use `nmem --json t search "query" --limit 5` when the user is asking about a prior conversation or exact session history.
3. If a result includes `source_thread`, inspect it progressively with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.
4. Prefer the smallest retrieval surface that answers the question — do not over-fetch.

## Deep mode

If results are weak or the need is conceptual/historical, try deeper matching:

```bash
nmem --json m search "query" --mode deep
```

## Filters

Add filters only when the task clearly implies them:

- By label: `-l "label-name"`
- By importance: `--importance 0.7`
- By date range: `--event-from 2026-01-01` / `--event-to 2026-03-01`
- By source: `-s codex`
- Limit results: `-n 10`

Summarize only the strongest matches and clearly say when nothing relevant was found.

## Links

- [Search documentation](https://mem.nowledge.co/docs/features/search)
