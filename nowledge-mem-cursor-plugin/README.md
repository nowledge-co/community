# Nowledge Mem for Cursor

> Cursor-native plugin package for Nowledge Mem: MCP-backed recall, Working Memory, distillation, and resumable handoffs.

This package follows Cursor's plugin format with `.cursor-plugin/plugin.json`, bundled rules, skills, and `.mcp.json` server config.

## What You Get

- MCP-backed `read_working_memory`, `memory_search`, `thread_search`, `thread_fetch_messages`, `memory_add`, and `memory_update`
- Cursor rules for Working Memory timing, proactive recall, retrieval routing, and add-vs-update behavior
- Four skills: `read-working-memory`, `search-memory`, `distill-memory`, and `save-handoff`
- A clear lifecycle: Working Memory, routed recall, distillation, and resumable handoffs

## Important Constraint

This plugin does **not** expose `save-thread` yet.

Cursor does not currently have a first-class Nowledge live session importer in this package, so a summary-only action must stay named `save-handoff`, not `save-thread`.

## Plugin Structure

```text
.cursor-plugin/plugin.json
rules/nowledge-mem.mdc
skills/*/SKILL.md
.mcp.json
```

## MCP Setup

The plugin ships a local default `.mcp.json`:

```json
{
  "mcpServers": {
    "nowledge-mem": {
      "url": "http://localhost:14242/mcp",
      "type": "streamableHttp"
    }
  }
}
```

For remote Mem, adjust the MCP server URL and headers using Cursor's MCP configuration flow.

## Optional CLI For Handoffs

If Nowledge Mem is running on the same machine through the desktop app, install `nmem` from **Settings -> Preferences -> Developer Tools -> Install CLI**.

That enables the `save-handoff` skill to create resumable handoff threads with `nmem --json t create`.

## Why The Rules Matter

Cursor can see the tools, but the bundled rules and skills tell it when to use them:

- read Working Memory once near the beginning of a session
- search proactively when the user references previous work or a similar bug
- search threads only when exact prior conversation history matters
- update an existing memory instead of duplicating it when the same decision evolves

## Validate Locally

Run the package validator before manual Cursor testing or marketplace submission:

```bash
cd community/nowledge-mem-cursor-plugin
node scripts/validate-plugin.mjs
```

## Install

This package is prepared for Cursor's plugin format and Cursor Marketplace review. Cursor's public docs currently center the marketplace install path and repository submission flow, not a stable documented local folder-loader. Treat this directory as the source-of-truth package for manual validation before publish, then install through the marketplace once the listing is live.

Release and submission notes live in [`RELEASING.md`](./RELEASING.md).

## Why This Design

- MCP is the strongest native execution layer Cursor exposes today for Nowledge Mem.
- Rules and skills add the lifecycle guidance that plain MCP config lacks.
- Handoffs stay separate from real thread save so the product contract remains correct.
