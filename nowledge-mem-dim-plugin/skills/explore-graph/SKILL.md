---
name: explore-graph
description: Show or expand the Nowledge Mem memory graph for memories just retrieved. Use after a successful memory search when the user asks to see, view, inspect, or explore the graph, and for bounded progressive expansion from a known memory.
---

# Explore the memory graph

Use the exact Memory IDs the current retrieval returned, in ranked order. Run this after a successful memory search with at least one result, or on an explicit graph request. Do not graph empty results or a Thread-only retrieval.

Keep the retrieval's configured endpoint, identity, permissions, and Space. Never infer a Space from the current folder, and never switch owner or default Space to make a graph work. Exact Memory IDs focus the view; they do not enforce access control. For a Space- or Team-restricted retrieval, show or expand a graph only when the graph surface is confirmed to enforce the same owner/member and Space restrictions. A supported scope parameter alone is not proof; otherwise skip the graph, explain the limitation, and continue with the retrieved evidence.

## Inline graph

If your tool list contains a Mem tool whose description reads the memory graph, call it with the retrieved IDs, `depth=1`, and `limit=15`. Do not open a duplicate browser page when the inline result succeeds. Describe what the graph shows only from the tool's actual result.

## Fallback: a verified link

When no graph tool exists, check Mem and read its API URL with:

```bash
nmem --json status
```

If status is not `ok`, report the reason and keep the successful search results. Do not invent an endpoint or change the user's configuration. If status is healthy and `api_url` is present, remove its trailing slash but keep the full path prefix, and use that API base both before `/graph/vis` and in the `base_url` parameter. URL-encode the API base and the comma-separated IDs separately:

```text
/graph/vis?standalone=1&base_url=<encoded API base>&memory_ids=<encoded IDs>&depth=1&limit=15
```

Never copy credentials, query strings, or fragments from a configured endpoint into a graph URL. Return the URL as a clickable link only when the browser would use the same identity and Space as the retrieval; otherwise skip it and explain why. CLI-only contexts cannot verify a browser session, so do not open or link a graph there.

## Progressive expansion

Expand from one exact seed Memory rather than loading the whole graph:

```bash
nmem --json graph expand <memory-id> --depth 1 --limit 20
```

Use an equivalent Mem MCP expansion tool when the host exposes one. One call is one hop; track `seed`, `visited`, `frontier`, and `hop`, de-duplicate IDs, and preserve edge types. Default bounds are 5 hops and 20 neighbors per hop. Do not auto-expand every neighbor, and do not pass unsupported scope flags to `graph expand`.

Stop when the evidence is sufficient, the frontier is empty or repeats, or the depth bound is reached, and say why you stopped. Graph rendering is best-effort: if a graph route, tool, or browser is unavailable, state the reason briefly and continue answering from the successful retrieval. Never claim a graph was rendered or a link opened without evidence.
