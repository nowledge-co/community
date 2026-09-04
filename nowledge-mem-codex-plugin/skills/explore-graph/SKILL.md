---
name: explore-graph
description: Open the user's interactive Nowledge Mem memory graph without relying on MCP Apps. Trigger only when the user explicitly asks to view, open, show, inspect, or explore their memory graph.
---

# Explore the memory graph

Check Nowledge Mem and read its current API URL:

```bash
nmem --json status
```

If `status` is not `ok`, report the error and suggest starting Nowledge Mem or
running the `status` skill. Otherwise, remove any trailing slash from `api_url`
and append:

```text
/graph/vis?standalone=1
```

- In local mode, open that URL in an available in-app browser panel. If the
  host has no such capability, return it as a clickable Markdown link.
- In remote mode, return the URL as a link and explain that the browser must
  already have an authenticated session. Never put an API key in a URL.

Use this only for an explicit graph request. Routine memory searches stay
compact and do not open the Graph Explorer.
