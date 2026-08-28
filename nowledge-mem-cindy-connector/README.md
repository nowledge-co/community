# Nowledge Mem for Cindy

Cindy is a local agent host that can run multiple harnesses such as Claude Code,
Codex, and Pi while keeping workspace, memory, skills, and tools continuous.
Nowledge Mem connects to Cindy in two layers:

- a `nowledge-mem` MCP server for Cindy's built-in agent surface
- shared Mem guidance so Cindy knows when to read, search, and save
- the dedicated child-runtime connectors for exact transcript capture when
  Cindy launches Claude Code, Codex, Pi, OMP, or another supported harness

This connector does not publish an npm package today. Cindy's public client has
a Ghost plugin runtime in progress, but transcript sync should wait for a stable
Cindy-native message export, lifecycle hook, or verified Ghost package install
path.

## Install

Make sure Nowledge Mem is running, then generate the Cindy MCP config from the
same client settings used by `nmem`:

```bash
nmem status
nmem config mcp show --host cindy
```

In Cindy, add a custom MCP server named `nowledge-mem` using the generated URL
and headers. For local desktop Mem, that points to:

```text
http://127.0.0.1:14242/mcp
```

For Nowledge Cloud, Access Anywhere, or a self-hosted server, configure the
local client first and regenerate the block:

```bash
nmem config client set url https://your-mem-server
nmem config client set api-key nmem_...
nmem config mcp show --host cindy
```

## Add Behavior Guidance

If your Cindy build accepts shared Agent Skills or Agent Plugins packages, add
the Nowledge Mem shared package:

```text
https://github.com/nowledge-co/community/tree/main/nowledge-mem-agent-plugin
```

If that package flow is not available yet, copy the guidance from `guide.md`
into Cindy's project or agent instructions.

## Thread Capture Boundary

MCP tools can search memory, read context, write durable memories, and search
threads that already exist in Mem. MCP does not import Cindy transcript files.

When Cindy launches another harness, install that harness's dedicated Nowledge
connector for exact transcript capture:

| Cindy task runtime | Mem path |
| --- | --- |
| Cindy built-in agent | Cindy MCP + shared guidance |
| Cindy-launched Codex | Codex connector |
| Cindy-launched Claude Code | Claude Code connector |
| Cindy-launched Pi | Pi package |
| Cindy-launched OMP | OMP plugin |

Keep `source_app` as the runtime that actually produced the transcript. A Codex
session launched inside Cindy should still import as `source=codex`, not
`source=cindy`.

## Future Native Ghost Package

Cindy's Ghost runtime can package skills, tools, and a local `mcp-stdio` Node
worker. A native Nowledge Mem Ghost package should become the preferred Cindy
install once it can be validated against Cindy's installer and marketplace
flows. Until then, this connector keeps the support boundary honest and avoids
claiming automatic Cindy-native thread sync.
