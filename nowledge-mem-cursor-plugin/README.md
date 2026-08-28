# Nowledge Mem for Cursor

> Cursor-native Nowledge Mem integration with MCP recall, startup context, automatic local transcript capture, distillation, and explicit handoffs.

This package follows Cursor's plugin format with `.cursor-plugin/plugin.json`, bundled rules and skills, `mcp.json`, and automatic `sessionStart` and `stop` hooks.

## What You Get

- MCP-backed `read_context_bundle`, `memory_search`, `thread_search`, `thread_fetch_messages`, `memory_add`, and `memory_update`
- Session-start Context Bundle or Working Memory bootstrap when `nmem` is available
- Automatic import of the exact current Cursor Agent transcript on `stop`
- Cursor rules for Working Memory timing, proactive recall, retrieval routing, and add-vs-update behavior
- Five skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-thread`, and `save-handoff`
- Historical Cursor transcript backfill through the client-side `nmem` importer

## Capture Contract

The `stop` hook performs a real transcript import, not a generated summary. It uses Cursor's `conversation_id` and current project directory to run the equivalent of:

```bash
nmem --json t save --from cursor --project /current/project --session-id <conversation-id> --truncate
```

Capture is deliberately bounded and fail-open:

- only the exact Cursor conversation is selected; the hook never falls back to an unrelated latest session
- delayed retries cover the short race between `stop` and Cursor flushing its transcript
- an atomic event claim suppresses duplicate hook delivery
- `nmem` create-or-append semantics make a repeated import idempotent
- failures are logged locally and the hook still returns `{}` so Cursor is never blocked

`save-thread` is the explicit/manual fallback for an immediate save or a failed/disabled hook. `save-handoff` remains a separate, summary-only checkpoint and is never presented as transcript capture.

## Scope Boundary

Automatic capture in this package is supported for local Cursor sessions where the hook process can access the local `nmem` CLI and Cursor transcript store. MCP connectivity alone does not grant access to local transcripts.

Do not assume a Cursor Cloud Agent can read `~/.cursor/projects` or receive a personal local plugin. If a transcript becomes available on the local machine later, use historical sync to backfill it.

## Plugin Structure

```text
.cursor-plugin/plugin.json
rules/nowledge-mem.mdc
skills/*/SKILL.md
hooks/hooks.json
hooks/nmem-runtime.mjs
hooks/session-start.mjs
hooks/stop-save.mjs
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

For remote Mem, adjust the MCP server URL and headers using Cursor's MCP configuration flow. Cursor's plugin format expects this file to be named `mcp.json`, not `.mcp.json`.

The hooks still run client-side, so configure the local `nmem` client for the same remote Mem service:

```bash
nmem config client set url https://your-server
nmem config client set api-key your-key
```

Cursor MCP settings cover tool calls. Local `nmem` configuration covers startup bootstrap, transcript capture, historical sync, and handoff creation on this machine.

## Install The CLI

If Nowledge Mem is running through the desktop app, install `nmem` from **Settings -> Preferences -> Developer Tools -> Install CLI**.

The hook runtime also searches common desktop CLI locations when Cursor starts with a restricted `PATH`. Set an explicit path if necessary:

```bash
export NMEM_CLI_PATH=/absolute/path/to/nmem
```

If `nmem` is unavailable, MCP tools can still work. Startup context, automatic transcript capture, manual transcript import, and handoff creation will be unavailable until the CLI is installed.

## Manual Save And Historical Backfill

Save the current project session manually:

```bash
nmem --json t save --from cursor --project . --truncate
```

Backfill all locally discoverable Cursor Agent transcripts:

```bash
nmem t sync --from cursor --all-projects --apply
```

Verify capture with a distinctive phrase from the session:

```bash
nmem t search "distinctive phrase"
```

## Beyond The Default Tools

Use the MCP tools for the day-to-day per-turn loop. For anything beyond
that -- including graph and relationship queries -- reach for the `nmem`
CLI directly. We recommend it whenever you hit a gap in the per-turn
tool set:

```bash
nmem graph expand <memory-or-crystal-id> --depth 2
nmem graph evolves <memory-id>
```

Run `nmem --help` (and `nmem graph --help`, `nmem <command> --help`, etc.)
to see its full capabilities.

## Spaces And Identity

Spaces are optional. The startup and capture hooks honor `NMEM_SPACE` (or legacy `NMEM_SPACE_ID`), `NMEM_AGENT_ID`, and `NMEM_HOST_AGENT_ID` when Cursor is launched in a stable lane.

MCP tool calls use their normal backend lane unless Cursor/runtime support forwards an explicit `space_id`. The Mem space profile remains authoritative; avoid creating a second Cursor-only scope model.

## Why The Rules Matter

Cursor can discover the tools and hooks, while the bundled rules and skills define when to use them:

- reuse freshly injected Context Bundle or Working Memory instead of immediately reading it again
- recall proactively when the user references previous work or a similar bug
- search threads only when exact prior conversation history matters
- update an existing memory instead of duplicating it when a decision evolves
- rely on automatic transcript capture normally, use `save-thread` only as an explicit fallback, and keep `save-handoff` summary-only

## Customize Without Editing The Plugin

Add project-specific behavior in `.cursor/rules/*.mdc` or `.cursorrules`, and keep the packaged `rules/nowledge-mem.mdc` intact. Do not patch installed files under `~/.cursor/plugins/...`; local rules survive plugin updates more reliably.

## Validate Locally

Run the package validator and hook contract tests before manual Cursor testing or marketplace submission:

```bash
cd community/nowledge-mem-cursor-plugin
node scripts/validate-plugin.mjs
node --test tests/*.test.mjs
```

## Install Locally

If the Marketplace listing is not available to your account, copy this package into Cursor's local plugin directory:

```bash
git clone https://github.com/nowledge-co/community.git
mkdir -p ~/.cursor/plugins/local
rm -rf ~/.cursor/plugins/local/nowledge-mem-cursor
cp -R /absolute/path/to/community/nowledge-mem-cursor-plugin ~/.cursor/plugins/local/nowledge-mem-cursor
```

Then restart Cursor or run `Developer: Reload Window`.

The package id is `nowledge-mem-cursor` so it does not collide with an older imported `nowledge-mem` package. If Cursor does not discover `sessionStart`, `stop`, or the five bundled skills, remove the stale imported package, keep only `~/.cursor/plugins/local/nowledge-mem-cursor`, and reload Cursor.

Cursor can have symlink-resolution problems for local plugin assets, so copying the package is the reliable default. A symlink may still be convenient for development:

```bash
ln -s /absolute/path/to/community/nowledge-mem-cursor-plugin ~/.cursor/plugins/local/nowledge-mem-cursor
```

## Marketplace Release

This package is prepared for Cursor Marketplace review. Release and submission notes live in [`RELEASING.md`](./RELEASING.md).

## Why This Design

- MCP remains the native surface for retrieval and durable memory operations.
- `sessionStart` provides bounded startup context without coupling it to transcript capture.
- `stop` supplies the exact session identity needed for safe client-side import.
- The importer owns Cursor transcript parsing and create-or-append semantics, so the plugin does not duplicate storage formats or persistence logic.
- `save-thread` and `save-handoff` stay separate because real transcripts and curated checkpoints have different contracts.
