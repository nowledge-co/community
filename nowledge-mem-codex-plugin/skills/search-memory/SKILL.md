---
name: search-memory
description: Search cross-tool Nowledge memories and threads for prior decisions, procedures, learnings, or exact history. Trigger for continuation, reviews, regressions, releases, rationale, or recall language even if Codex local Memory already shows a related summary.
---

Find what the user already knows. Search their memories and past conversations for decisions, procedures, and context that make the current task sharper.

For continuation-style engineering work, search near the start of the task. Do not wait for the user to literally say "search memory".

Codex local Memory is useful as a hint, but it is not a substitute for this search when provenance, exact history, current cross-tool state, or prior decisions matter.

## When to use

**Strong signals (search when):**

- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, incident, or subsystem
- The task is a review, regression, release, docs-alignment, or connector-behavior question
- A debugging pattern resembles something solved earlier
- The user asks for rationale, preferences, procedures, or recurring workflow details
- The user uses implicit recall language: "that approach", "like before", "the pattern we used"

**Contextual signals (consider searching when):**

- Complex debugging where prior context would narrow the search space
- Architecture discussion that may intersect with past decisions
- Domain-specific conventions the user has established before
- The current result is ambiguous and past context would make the answer sharper

**When NOT to search:**

- Fundamentally new topic with no prior history
- Generic syntax or API questions answerable from documentation
- User explicitly asks for a fresh perspective without prior context

## Retrieval routing

If this session already exposes the Nowledge Mem MCP server, prefer:

1. `memory_search` for durable knowledge (decisions, insights, procedures).
2. `thread_search` when the user is asking about a prior conversation or exact session history.
3. `thread_fetch_messages` for progressive inspection of the matching thread.

Otherwise:

1. Start with `nmem --json m search "query"` for durable knowledge (decisions, insights, procedures).
2. Use `nmem --json t search "query" --limit 5` when the user is asking about a prior conversation or exact session history.
3. If a result includes `source_thread`, inspect it progressively with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.

Prefer the smallest retrieval that answers the question. Do not over-fetch.
Use a limit of 5 for ordinary Memory retrieval unless the task needs more.

If the runtime already knows the active project or agent lane, add `--space "<space name>"` to these commands.

## Show what was retrieved

After every successful `memory_search` that returns at least one Memory,
automatically visualize the result set. Preserve the server's ranked order and
pass all returned Memory IDs; never infer or substitute IDs.

1. Prefer the MCP `explore_graph` tool with the comma-separated IDs,
   `depth=1`, and `limit=15`. Its MCP App metadata lets a capable host render
   the focused graph inline in chat.
2. If `explore_graph` is unavailable, use the `explore-graph` skill's
   standalone fallback with the same exact IDs.
3. Do not open a second standalone graph when the inline App succeeds. Do not
   open a graph for an empty result set or for thread-only retrieval.

Whenever Memory results materially inform the answer, include a compact
retrieval trace with the observable `query`, `mode`, `scope`, `filters`, and
the result `rank`, Memory ID, title, and server-returned `score` when present.
Name whether MCP or the `nmem` CLI performed the search. If the server omits a
field, say it was unavailable instead of guessing. Do not expose or invent hidden reasoning; this trace describes tool inputs and outputs only.

## Deep mode

If results are weak or the need is conceptual/historical, try deeper matching:

```bash
nmem --json m search "query" --mode deep
```

## Knowledge tree routing

When the user needs to browse across multiple object types, inspect nearby context, or asks for a file/tree/vault-like view, use the Knowledge Filesystem instead of only flat search.

Prefer MCP `mem_fs` when available:

```text
capabilities
recall "session token strategy" --in /memories -k 5
find /memories --label decisions --since 2026-01-01
grep "JWT rotation" /memories
grep -E "JWT|token" /threads
cat /memories/by-id/<id>.memory.md
```

Otherwise use:

```bash
nmem fs capabilities --json
nmem fs recall "session token strategy" --in /memories -k 5
nmem fs ls /wiki
nmem fs cat /wiki/topics/<topic>.topic.md
```

Use `capabilities` before assuming roots or future verbs. Use `recall` for fuzzy phrasing, `find` for metadata constraints, `grep` for exact strings, `grep -E` for explicit regex, then `stat` or `cat` the returned paths. KFS paths are Mem identifiers, not local OS files; mount and SQL/Cypher are later phases.

## Filters

Add filters only when the task clearly implies them:

- By label: `-l "label-name"`
- By importance: `--importance 0.7`
- By date range: `--event-from 2026-01-01` / `--event-to 2026-03-01`
- By source: `-s codex`
- Limit results: `-n 5` by default; increase only when the task needs it

Summarize only the strongest matches and clearly say when nothing relevant was found.

## Links

- [Search](https://mem.nowledge.co/docs/search-relevance)
