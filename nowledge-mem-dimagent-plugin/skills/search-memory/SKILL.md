---
name: search-memory
description: Search cross-tool Nowledge memories and threads for prior decisions, procedures, learnings, or exact history, with normal, deep, and progressive graph-backed retrieval. Trigger for continuation, reviews, regressions, releases, rationale, or recall language even if DimAgent-local memory already shows a related summary.
---

Find what the user already knows. Search their memories and past conversations for decisions, procedures, and context that make the current task sharper.

For continuation-style engineering work, search near the start of the task. Do not wait for the user to literally say "search memory".

DimAgent-local memory is useful as a hint, but it is not a substitute for this search when provenance, exact history, current cross-tool state, or prior decisions matter.

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

## Intelligent retrieval routing

Treat retrieval mode and graph traversal as separate decisions. Start with the
smallest mode that can answer the user's question, then escalate only when the
result or the user's intent justifies it.

1. **Normal (default)**: use `memory_search` (or
   `nmem --json m search "query" --mode normal`) for a bounded recall of a
   concrete fact, a recent decision, or a simple "what do we know" question.
   Keep the default limit at 5.
2. **Deep**: use `mode="deep"` (or `--mode deep`) when the user asks about
   concepts, rationale, history, relationships across topics, or why a choice
   was made. Escalate after Normal when it is empty, ambiguous, weakly
   supported, conflicting, or leaves an important part of the question
   unanswered. Prefer the server's evidence and trust warnings over a hardcoded
   score threshold; never invent a threshold the server did not return.
3. **Progressive graph search**: use it when the user names an exact Memory ID
   or URI, asks to start from a node, or wants related memories, neighbors,
   lineage, or a trace. If no seed is supplied, run a bounded Normal/Deep
   search first and select only exact IDs from its ranked results.

After a non-empty search, the default graph view is a focused graph of that
result set. A graph view does not by itself mean "search the whole graph".
Use progressive expansion only when more relational evidence is needed or the
user asks to continue.

### Progressive one-hop protocol

Maintain this explicit state across expansion calls:

- `seed`: the exact starting Memory ID(s)
- `visited`: IDs already inspected, including the seed
- `frontier`: newly discovered candidate IDs that may be expanded next
- `hop`: the current graph distance from the seed

For each step, expand one selected frontier node by one hop:

```bash
nmem --json graph expand <memory-id> --depth 1 --limit 20
```

Use an equivalent graph-expansion MCP tool when the host exposes one. Keep
`depth=1` per call, de-duplicate against `visited`, preserve edge types and
the returned order, and update `frontier` only with new relevant IDs. Default
limits are at most 5 hops and 20 neighbors per hop. Do not automatically
expand every neighbor or empty the whole graph in one turn. Stop when the
answer is sufficiently supported, the next frontier is empty/repeated, or the
maximum depth is reached. If the user explicitly requests a deeper walk, still
make it one hop per call and stop at depth 5 unless the server advertises a
different safe limit.

For progressive results, report the seed, hop, center node, newly discovered
IDs, remaining frontier, and the reason for stopping or continuing. This is a
retrieval trace, not hidden chain-of-thought.

Preserve the configured identity and Space. Use explicit scope arguments only
where the installed command supports them; do not infer a Space from the
current folder. The graph expansion command may rely on ambient configuration
and may not support `--space`. Apply the scope checks in `explore-graph` before
expansion; if the graph surface cannot enforce the retrieval scope, skip it.

## Show what was retrieved

After every successful `memory_search` or equivalent CLI/KFS Memory search that
returns at least one Memory,
automatically visualize the result set. Preserve the server's ranked order and
pass all returned Memory IDs; never infer or substitute IDs.

First apply the `explore-graph` skill's identity and Space checks. Exact seed
IDs do not enforce authorization. For Space- or Team-restricted retrieval,
visualize only when the graph surface is confirmed to enforce the same
owner/member/Space restrictions. Otherwise skip the graph and explain why.

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
- By source: `-s dimagent`
- Limit results: `-n 5` by default; increase only when the task needs it

Summarize only the strongest matches and clearly say when nothing relevant was found.

## Links

- [Search](https://mem.nowledge.co/docs/search-relevance)
