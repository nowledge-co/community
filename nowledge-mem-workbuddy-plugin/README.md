# Nowledge Mem for WorkBuddy

Bring current context and exact prior work into Tencent WorkBuddy, then keep new WorkBuddy conversations searchable across every AI tool connected to Nowledge Mem.

## What It Does

- Loads your current Context Bundle when a WorkBuddy session starts.
- Routes continuation, prior-decision, preference, regression, and exact-history work to Nowledge Mem.
- Exposes structured memory and thread tools through MCP.
- Captures main-agent and subagent transcripts at WorkBuddy lifecycle boundaries.
- Adds `/nowledge-mem:status`, `/nowledge-mem:sync-now`, and `/nowledge-mem:import-history`.
- Keeps hook failures quiet so an unavailable Mem service never blocks WorkBuddy.

## Requirements

1. Nowledge Mem desktop running locally, or a reachable remote Mem server.
2. A WorkBuddy release with plugin hooks.
3. A current `nmem` CLI on the WorkBuddy machine.

For the desktop-bundled CLI, open Mem and use **Settings -> Preferences -> Developer Tools -> Install bundled CLI**. Standalone users can upgrade `nmem-cli` through their existing Python or pipx installation.

For remote Mem:

```bash
nmem config client set url https://your-mem-server
nmem config client set api-key your-key
```

## Install

In WorkBuddy:

```text
/plugin marketplace add https://raw.githubusercontent.com/nowledge-co/community/main/.workbuddy-plugin/marketplace.json --name nowledge-community
/plugin install nowledge-mem@nowledge-community
```

Use the raw WorkBuddy marketplace URL exactly as shown. Current WorkBuddy releases check `.codebuddy-plugin` before `.workbuddy-plugin` at a repository root, so adding `nowledge-co/community` directly can select the CodeBuddy package.

If you previously added the repository root, migrate it once:

```text
/plugin marketplace remove nowledge-community
/plugin marketplace add https://raw.githubusercontent.com/nowledge-co/community/main/.workbuddy-plugin/marketplace.json --name nowledge-community
/plugin install nowledge-mem@nowledge-community
```

Removing the old marketplace clears its enabled entry; the final install restores it from the dedicated WorkBuddy package. Restart or reload WorkBuddy after installation.

The bundled MCP endpoint targets local Mem. For remote Mem or authenticated localhost, generate a user-owned override:

```bash
nmem config mcp show --host workbuddy
```

Place the generated block in `~/.workbuddy/.mcp.json`, `$WORKBUDDY_CONFIG_DIR/.mcp.json`, or a project `.mcp.json`.

## Automatic Thread Capture

WorkBuddy provides `session_id` and the exact local transcript path to plugin hooks. The connector syncs at:

- `PreCompact`, before context compression
- `Stop`, after a completed turn
- `SubagentStop`, after delegated work
- `SessionEnd`, when the session closes

The hook runs:

```bash
nmem --json t sync --from workbuddy --session-id <session-id> --session-dir <transcript_path> --all-projects --apply
```

Imports are idempotent. Repeated lifecycle events update the same WorkBuddy thread and deduplicate messages.
For `SubagentStop`, WorkBuddy reports the parent session separately from `agent_id`; the connector uses the subagent's own ID so delegated transcripts cannot collide with the parent thread's message IDs.

## Verify

Start a new WorkBuddy session and ask it to read your current context. Complete a short exchange, then run:

```bash
nmem t list --source workbuddy -n 5
```

Hook diagnostics are stored in WorkBuddy's plugin data directory. Older hosts fall back to:

```bash
tail -n 50 ~/.workbuddy/logs/nowledge-mem-hook.log
```

## Older Sessions

Preview first:

```bash
nmem t sync --from workbuddy --limit 20
```

Then import:

```bash
nmem t sync --from workbuddy --apply
```

The CLI reads `$WORKBUDDY_CONFIG_DIR/projects` or `~/.workbuddy/projects` locally and uploads normalized threads to the configured Mem server.

## Customize

Keep personal behavior in `~/.workbuddy/CODEBUDDY.md`, a project `CODEBUDDY.md`, or `.workbuddy/rules/*.md`. Do not edit installed plugin files; marketplace updates replace them.

## Links

- [WorkBuddy guide](https://mem.nowledge.co/docs/integrations/workbuddy)
- [All connectors](https://mem.nowledge.co/docs/integrations)
- [Nowledge Mem](https://mem.nowledge.co)
