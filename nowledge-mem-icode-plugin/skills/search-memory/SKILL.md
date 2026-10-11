---
name: search-memory
description: Search cross-tool Nowledge memories and threads for prior decisions, procedures, learnings, or exact history in iCode. Trigger for continuation, reviews, regressions, releases, rationale, or recall language, even when project AGENTS.md or the session context already shows a related summary.
---

Find what the user already knows. Search their memories and past conversations
for decisions, procedures, and context that make the current task sharper.

In iCode, prefer the Nowledge Mem MCP tools when loaded: `memory_search` for
semantic memory search, `thread_search` for past conversations (load them via
the MCP tool loader if only a subset is visible). CLI fallback: `nmem --json
m search "query"` and `nmem --json t search "query"`.

## When to use

**Strong signals (search when):**

- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, incident, or subsystem
- The task is a review, regression, release, or connector-behavior question
- A debugging pattern resembles something solved earlier
- The user asks for rationale, preferences, procedures, or recurring workflow details
- The user uses implicit recall language: "that approach", "like before", "the pattern we used"

**Contextual signals (consider searching when):**

- Complex debugging where prior context would narrow the search space
- Architecture discussion that may intersect with past decisions
- The current result is ambiguous and past context would sharpen it

**When NOT to search:** trivial edits, style questions, or anything the user
just explained in this conversation.

Session-start context and project AGENTS.md are hints, not substitutes: when
provenance, exact history, or current cross-tool state matter, run the search.
