# Nowledge Mem for Cursor

> Cursor-native plugin package for Nowledge Mem: MCP-backed recall, session-start Working Memory bootstrap, distillation, and resumable handoffs.

This package follows Cursor's plugin format with `.cursor-plugin/plugin.json`, bundled rules, skills, `mcp.json`, and a `sessionStart` hook for Working Memory bootstrap.

## What You Get

- MCP-backed `read_working_memory`, `memory_search`, `thread_search`, `thread_fetch_messages`, `memory_add`, and `memory_update`
- Session-start Working Memory bootstrap when `nmem` is available
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
hooks/hooks.json
hooks/session-start.mjs
mcp.json
```

## MCP Setup

The plugin ships a local default `mcp.json`:

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

For remote Mem, adjust the MCP server URL and headers using Cursor's MCP configuration flow. The official Cursor plugin template expects the plugin package file to be named `mcp.json`, not `.mcp.json`.

If you also want the `sessionStart` hook and `save-handoff` skill to work against remote Mem, configure the local `nmem` client too:

```bash
nmem config client set url https://your-server:14242
nmem config client set api-key your-key
```

Cursor MCP settings cover only the plugin's tool calls. The local `nmem` client config covers the client-side `sessionStart` hook and `save-handoff` skill behaviors on this machine. Server-side remote-access settings on the Mem host are configured separately.

## Recommended CLI For Session Bootstrap And Handoffs

If Nowledge Mem is running on the same machine through the desktop app, install `nmem` from **Settings -> Preferences -> Developer Tools -> Install CLI**.

That enables two important package behaviors:

- the `sessionStart` hook can preload Working Memory into new Cursor agent sessions
- the `save-handoff` skill can create resumable handoff threads with `nmem --json t create`

If `nmem` is unavailable, the MCP tools still work. Only the automatic Working Memory bootstrap and handoff creation are affected.

## Spaces

Spaces are optional. Cursor does not yet expose one shared ambient `space_id` across all MCP calls in this package, so the current split is:

- `sessionStart` Working Memory bootstrap and `save-handoff` can follow `NMEM_SPACE_ID=<space_id>` when Cursor is launched in a stable lane.
- MCP tool calls stay on their normal backend lane unless Cursor/runtime support is extended to pass `space_id`.

If you do not have a real ambient lane, stay on `Default`.

## Why The Rules Matter

Cursor can see the tools, but the bundled rules and skills tell it when to use them:

- let the session-start hook provide Working Memory when available, and only call `read_working_memory` when you need a refresh or the hook could not load it
- search proactively when the user references previous work or a similar bug
- search threads only when exact prior conversation history matters
- update an existing memory instead of duplicating it when the same decision evolves

## Validate Locally

Run the package validator before manual Cursor testing or marketplace submission:

```bash
cd community/nowledge-mem-cursor-plugin
node scripts/validate-plugin.mjs
```

## Install Locally Today

Cursor's local plugin path is ready now. If the Marketplace listing is not
available to your account, install this package directly:

```bash
git clone https://github.com/nowledge-co/community.git
mkdir -p ~/.cursor/plugins/local
rm -rf ~/.cursor/plugins/local/nowledge-mem-cursor
cp -R /absolute/path/to/community/nowledge-mem-cursor-plugin ~/.cursor/plugins/local/nowledge-mem-cursor
```

Then restart Cursor or run `Developer: Reload Window`.

This package intentionally uses the plugin id `nowledge-mem-cursor` so it does
not collide with Cursor's imported Claude-oriented `nowledge-mem` package.

If Cursor still shows Claude Code wording, `save-thread`, or hooks like
`beforeSubmitPrompt` and `stop`, Cursor is not running this package. Remove the
older imported `nowledge-mem` package from Cursor, keep only
`~/.cursor/plugins/local/nowledge-mem-cursor`, then reload Cursor again.

Cursor loads local plugins from `~/.cursor/plugins/local/<plugin-name>` when
`.cursor-plugin/plugin.json` is at the package root. This package already
matches that layout.

If you want faster iteration, you can try a symlink instead:

```bash
ln -s /absolute/path/to/community/nowledge-mem-cursor-plugin ~/.cursor/plugins/local/nowledge-mem-cursor
```

But Cursor currently has known symlink-resolution bugs for local plugin assets,
so copy-first is the reliable path.

## Install From Marketplace Later

This package is also prepared for Cursor Marketplace review. Once the listing
is accepted and visible, install `Nowledge Mem` from Cursor Marketplace and use
the same package behavior.

Release and submission notes live in [`RELEASING.md`](./RELEASING.md).

## Why This Design

- MCP is the strongest native execution layer Cursor exposes today for Nowledge Mem.
- The session-start hook is the smallest reliable automatic context surface, so it bootstraps Working Memory without pretending Cursor has a real transcript-capture path.
- Rules and skills add the lifecycle guidance that plain MCP config lacks.
- Handoffs stay separate from real thread save so the product contract remains correct.
