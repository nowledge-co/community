# Nowledge Mem for Cursor

> Cursor-native plugin package for Nowledge Mem: MCP-backed recall, Working Memory, distillation, and resumable handoffs.

This package follows Cursor's plugin format with `.cursor-plugin/plugin.json`, bundled rules, skills, and `.mcp.json` server config.

## What You Get

- MCP-backed `read_working_memory`, `memory_search`, `thread_search`, `thread_fetch_messages`, and `memory_add`
- Cursor rule for routed recall across memories and threads
- Four skills: `read-working-memory`, `search-memory`, `distill-memory`, and `save-handoff`
- Honest lifecycle contract: Working Memory, routed recall, distillation, and handoff summaries

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

## Install

This package is prepared for Cursor's plugin format and Cursor Marketplace review. Until it is published in the marketplace, use the plugin directory as the installable source of truth together with Cursor's plugin workflow.

## Why This Design

- MCP is the strongest native execution layer Cursor exposes today for Nowledge Mem.
- Rules and skills add the lifecycle guidance that plain MCP config lacks.
- Handoffs stay separate from real thread save so the product contract remains correct.
