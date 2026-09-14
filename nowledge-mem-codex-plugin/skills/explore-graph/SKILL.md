---
name: explore-graph
description: Render a focused interactive graph for memories retrieved from Nowledge Mem, automatically after successful Memory retrieval or when the user explicitly asks to view, show, inspect, or explore their memory graph; support bounded progressive node expansion.
---

# Explore the memory graph

Use the exact Memory IDs returned by the current retrieval, in ranked order.
Run this automatically after a successful Nowledge Memory search with at least
one result, or on an explicit graph request.

Prefer the MCP `explore_graph` tool when it is available:

```text
explore_graph(memory_ids="id1,id2", depth=1, limit=15)
```

This is the inline chat path: the tool owns the MCP App metadata and the host
can render its result as an interactive card. Do not open a duplicate browser
page when the inline card succeeds.

If the tool is unavailable, check Nowledge Mem and read its current API URL:

```bash
nmem --json status
```

If `status` is not `ok`, report the error and suggest starting Nowledge Mem or
running the `status` skill. Otherwise, remove any trailing slash from `api_url`
and append a focused URL. URL-encode the comma-separated IDs as one query value:

```text
/graph/vis?standalone=1&memory_ids=<URL-encoded comma-separated IDs>&depth=1&limit=15
```

- In local mode, open that URL in an available in-app browser panel. If the
  host has no such capability, return it as a clickable Markdown link.
- In remote mode, return the URL as a link and explain that the browser must
  already have an authenticated session. Never put an API key in a URL.

Only open the full overview at `/graph/vis?standalone=1` when the user
explicitly asks for the whole graph and there are no selected or freshly
retrieved Memory IDs. Do not open a graph for an empty search result.

## Default depth and progressive expansion

The default focused graph uses `depth=1` and `limit=15`. Use a deeper focused
view only when the user asks for more context; cap an explicit graph view at
`depth=5` and keep the returned Memory IDs exact.

When the user asks to explore from one node, use the exact seed Memory ID and
expand progressively rather than loading the entire graph:

```bash
nmem --json graph expand <memory-id> --depth 1 --limit 20
```

Track `seed`, `visited`, `frontier`, and `hop`. Each expansion call is one hop;
de-duplicate IDs already in `visited`, preserve edge types, and add only new
relevant nodes to `frontier`. Default bounds are 5 hops and 20 neighbors per
hop. Do not auto-expand every neighbor. After a non-empty hop, refresh the
focused graph with the exact seed and newly relevant IDs when useful. Stop when
the evidence is sufficient, the frontier is empty or repeated, or the depth
bound is reached, and report that stopping reason.
