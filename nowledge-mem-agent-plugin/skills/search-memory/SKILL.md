---
name: search-memory
description: Search Nowledge Mem memories and prior threads for past decisions, procedures, and context with normal, deep, or progressive retrieval; automatically show a focused graph of successful Memory results.
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

Prefer the host's Nowledge Mem MCP tools when exposed: `memory_search` for
durable knowledge, `thread_search` for past conversations, and
`thread_fetch_messages` for inspecting a matching conversation. Otherwise:

1. Start with `nmem --json m search "query" -n 5` for durable knowledge.
2. Use `nmem --json t search "query" --limit 5` for a prior conversation or exact session history.
3. If a result includes `source_thread`, inspect it progressively with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.
4. Prefer the smallest retrieval surface that answers the question.

For continuation-heavy engineering work, search near the start of the task. Do not wait for the user to literally ask for memory search.

Keep the configured endpoint, owner, agent identity, and active space. If the
runtime already knows an active lane, pass that scope through the supported
MCP parameters or add `--space "<space name>"` to CLI commands. Never infer a
space from the current folder or switch owners or spaces to find more results.

## Retrieval Modes

- **Normal (default)**: use `memory_search` with `mode="normal"`, or
  `nmem --json m search "query" --mode normal -n 5`, for concrete facts and
  bounded recall.
- **Deep**: use `mode="deep"` or `--mode deep` for conceptual questions,
  rationale, history, or relationships across topics. Escalate from Normal
  when its evidence is empty, ambiguous, conflicting, or insufficient. Do not
  invent score thresholds the server did not return.
- **Progressive graph search**: start from an exact Memory ID when the user
  asks for related nodes, lineage, or stepwise exploration. Without a seed,
  first run a bounded Normal or Deep search and use its exact returned IDs.
  Follow the `explore-graph` skill's one-hop protocol and stopping bounds;
  showing a focused graph does not automatically start a graph crawl.

## Show What Was Retrieved

After every successful `memory_search` or equivalent CLI/KFS Memory search
that returns at least one Memory, automatically show a focused graph. Preserve
ranked order and all returned Memory IDs; never infer or substitute IDs.

1. Prefer MCP `explore_graph` with the comma-separated IDs, `depth=1`, and
   `limit=15` for hosts that can render its inline MCP App.
2. Use the `explore-graph` skill for the standalone browser or link fallback
   and for bounded progressive expansion. If that skill was not installed,
   state that the fallback is unavailable and suggest installing it alongside
   `search-memory`.
3. Do not open a duplicate standalone graph when inline rendering succeeds.
   Do not graph an empty result set or thread-only retrieval.

Keep the same owner/member permissions, identity, and space when rendering.
Exact result IDs do not enforce access control: for Space- or Team-restricted
retrieval, graph only when that surface is confirmed to enforce the same
restrictions. Follow `explore-graph`'s identity and scope checks before returning
a browser URL. Graph failures must not turn a successful retrieval into an
error: report the reason briefly and continue with the retrieved evidence.
If no matching evidence was found, say so.

When Memory results inform the answer, report the query, mode, scope, and
strongest matching Memory IDs and titles concisely. Use server-returned scores
only when present; do not invent missing metadata or hidden reasoning.

## Native Connector

These skills work through the CLI or the host's existing MCP connection;
focused graph viewing does not require a native connector. For automatic
recall, transcript capture, and host lifecycle hooks, prefer your agent's
dedicated connector. Run `check-integration` when installed or see the
[integration guide](https://mem.nowledge.co/docs/integrations).
