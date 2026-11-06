---
name: search-memory
description: Search Nowledge Mem memories and threads before concluding work that depends on prior context. Use for continuation, review, regression, release, connector, or exact-history work, and whenever the user refers to earlier work or decisions.
---

# Search Memory

Search proactively when past knowledge would change the answer. Do not wait for the user to ask for a search.

## When to search

Strong signals:

- the user references previous work, a prior fix, or an earlier decision;
- the task resumes a named feature, bug, refactor, incident, or subsystem;
- a debugging pattern resembles something solved before;
- the user asks for rationale, preferences, procedures, or a recurring workflow;
- the user uses recall language such as "that approach", "like before", or "the pattern we used".

Skip the search for a genuinely new topic, a generic question answerable from documentation, or an explicit request for a fresh perspective.

## Retrieval routing

1. Durable knowledge first (decisions, insights, procedures): the Mem tool whose description reads memory search, or `nmem --json m search "<query>" -n 5`.
2. Prior conversations and exact session history: the Mem thread-search tool, or `nmem --json t search "<query>" --limit 5`.
3. If a memory result names a source Thread and you need the original wording, read that Thread once, bounded: `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.
4. Prefer the smallest retrieval surface that answers the question. Do not over-fetch.
5. If results are weak or conceptual, try `--mode deep`.

Never loop over offsets to reconstruct a conversation. One bounded Thread read per question; if a read is slow, incomplete, or fails, stop, report the evidence gap, and refine the search.

## Scope and honesty

Keep the configured identity and Space; pass `--space "<space name>"` or `--space-id <exact id>` when the lane is known, and do not widen the search silently. Shared or cross-Space recall must be explicit.

If retrieval fails or times out, say so briefly and continue with what you have. Do not report a failed search as "no matches". Inspect only the results that matter to the task.
