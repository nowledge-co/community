---
name: explore-graph
description: Render a focused interactive graph for memories retrieved from Nowledge Mem, automatically after successful Memory retrieval or when the user explicitly asks to view, show, inspect, or explore their memory graph; support bounded progressive node expansion.
---

# Explore the memory graph

Use the exact Memory IDs returned by the current retrieval, in ranked order.
Run this automatically after a successful Nowledge Memory search with at least
one result, or on an explicit graph request. Do not graph empty results or
thread-only retrieval.

Keep the retrieval's configured endpoint, owner/member permissions, agent
identity, and active space. Never infer a space from the current folder or
switch to a different owner or default space to make a graph work. Exact Memory
IDs focus the view; they do not enforce access control. For Space- or
Team-restricted retrieval, show or expand a graph only when the graph surface
is confirmed to enforce the same owner/member and Space restrictions. Passing
a supported scope parameter alone does not prove enforcement. Otherwise, skip
the graph, explain the scope limitation, and continue with the retrieved evidence.

## Show the retrieved memories

Prefer the MCP `explore_graph` tool when it is available:

```text
explore_graph(memory_ids="id1,id2", depth=1, limit=15)
```

This is the inline chat path: the tool owns the MCP App metadata and the host
can render its result as an interactive card. Do not open a duplicate browser
page when the inline card succeeds. A host without MCP App support can use the
standalone fallback below.

If the tool is unavailable or the inline graph fails, check Nowledge Mem and
read its current API URL using the same client configuration as retrieval:

```bash
nmem --json status
```

If `nmem` is unavailable, or `status` is not `ok`, report the reason and keep
the successful search results. Suggest the `status` skill when installed;
do not invent an endpoint or change the user's configuration. If status is
healthy and `api_url` is present, remove its trailing slash but preserve the
full path prefix. Use that same API base both before `/graph/vis` and in the
`base_url` query parameter: the page otherwise defaults API requests to the
origin and loses prefixes such as `/remote-api`. URL-encode the full API base
and comma-separated IDs as separate query values. Never copy credentials,
query strings, or fragments from a configured endpoint into a graph URL:

```text
/graph/vis?standalone=1&base_url=<URL-encoded full API base>&memory_ids=<URL-encoded comma-separated IDs>&depth=1&limit=15
```

For example, API base `https://mem.example.com/remote-api/` and IDs `id1,id2`
produce this URL (subject to the browser checks below):

```text
https://mem.example.com/remote-api/graph/vis?standalone=1&base_url=https%3A%2F%2Fmem.example.com%2Fremote-api&memory_ids=id1%2Cid2&depth=1&limit=15
```

- Before opening or returning a browser URL automatically, require trusted
  browser/session context confirming the same owner/member identity and active
  space as retrieval, plus the graph enforcement check above. CLI status or HTTP 200
  does not establish browser identity. If the host cannot supply this evidence,
  skip the URL and explain why.
- CLI-only hosts cannot verify a browser session: there is no automatic browser or link fallback
  in that environment. Keep the successful retrieval and report that limitation;
  do not invent a session-check command or treat endpoint reachability as proof.
- In local mode, open the verified URL through an available host browser capability
  when the user's permissions allow it. If opening is unavailable but the
  session checks have passed, return a clickable Markdown link. Do not require a particular browser.
- In remote mode, return the verified URL as a link and explain that the
  browser uses its existing authenticated session for the same owner and space.
  Never put an API key in a URL.

Only open the full overview at `/graph/vis?standalone=1` when the user
explicitly asks for the whole graph and there are no selected or freshly
retrieved Memory IDs. Preserve `base_url` and the same browser checks for the
overview as well. Do not open a graph for an empty search result.

Graph rendering is best-effort: if a graph route, tool, or browser is
unavailable, briefly state the reason and continue answering from the successful
retrieval. Do not claim a link was opened or a graph rendered without evidence.
A dedicated native connector is optional for graph viewing; it may add host
integration, automatic capture, or richer lifecycle behavior.

## Default depth and progressive expansion

The default focused graph uses `depth=1` and `limit=15`. Use a deeper focused
view only when the user asks for more context; cap an explicit graph view at
`depth=5` and keep the returned Memory IDs exact.

When the user asks to explore from one node, use the exact seed Memory ID and
expand progressively rather than loading the entire graph:

```bash
nmem --json graph expand <memory-id> --depth 1 --limit 20
```

Use an equivalent MCP expansion tool when the host exposes one. Preserve the
same configured identity and space through the CLI's supported ambient
configuration. Do not add unsupported scope flags to `graph expand`. If an
explicit scope is required but the tool cannot enforce it, or graph expansion
is unavailable, skip expansion, explain the limitation, and retain the evidence
already found.

Track `seed`, `visited`, `frontier`, and `hop`. Each expansion call is one hop;
de-duplicate IDs already in `visited`, preserve edge types, and add only new
relevant nodes to `frontier`. Default bounds are 5 hops and 20 neighbors per
hop. Do not auto-expand every neighbor. After a non-empty hop, refresh the
focused graph with the exact seed and newly relevant IDs when useful. Stop when
the evidence is sufficient, the frontier is empty or repeated, or the depth
bound is reached, and report that stopping reason.
