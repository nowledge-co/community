---
name: search-memory
description: Search your personal knowledge base when past insights would improve response. Recognize when stored breakthroughs, decisions, or solutions are relevant. Search proactively based on context, not just explicit requests.
---

# Search Memory

> AI-powered search across your personal knowledge base using Nowledge Mem.

## When to Use

**Strong signals — search when:**

- the user references previous work, a prior fix, or an earlier decision
- the task resumes a named feature, bug, refactor, incident, or subsystem
- the task is a review, regression, release, docs-alignment, or connector-behavior question
- a debugging pattern resembles something solved earlier
- the user asks for rationale, preferences, procedures, or recurring workflow details
- the user uses implicit recall language: "that approach", "like before", "the pattern we used"

**Contextual signals — consider searching when:**

- complex debugging where prior context would narrow the search space
- architecture discussion that may intersect with past decisions
- domain-specific conventions the user has established before
- the current result is ambiguous and past context would make the answer sharper

## Retrieval Routing

1. Start with `nmem --json m search` for durable knowledge.
2. Use `nmem --json t search` when the user is really asking about a prior conversation or exact session history.
3. If a result includes `source_thread`, inspect it once for the specific messages needed with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.
4. Prefer the smallest retrieval surface that answers the question.

For continuation-heavy engineering work, search near the start of the task. Do not wait for the user to literally ask for memory search.

If the host already knows the active project or agent lane, add `--space "<space name>"` to these commands.

## Native Connector

These skills work in any agent via CLI. For auto-recall, auto-capture, and graph tools, check if your agent has a native Nowledge Mem connector — run the `check-integration` skill or see https://mem.nowledge.co/docs/integrations

### Bounded thread reads

Search memories or threads first, then choose the specific conversation and message range needed. Call `thread_fetch_messages`, a host thread-fetch tool, or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.
