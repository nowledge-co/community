# Nowledge Mem for WorkBuddy and CodeBuddy

Cross-tool memory for Tencent WorkBuddy and CodeBuddy Code. Your decisions, preferences, procedures, and useful coding conversations stay searchable across every AI tool connected to Nowledge Mem.

## What You Get

- WorkBuddy and CodeBuddy can read Context Bundle / Working Memory before important work.
- WorkBuddy and CodeBuddy can search memories and prior threads through MCP, with `nmem` CLI fallback.
- WorkBuddy and CodeBuddy can save durable decisions and procedures into Nowledge Mem.
- WorkBuddy and CodeBuddy conversations sync into Mem Threads through lifecycle hooks.
- Subagent work is captured through `SubagentStop` using the host's own `transcript_path`.
- Quick commands are available as `/nowledge-mem:status`, `/nowledge-mem:sync-now`, and `/nowledge-mem:import-history`.
- Older WorkBuddy sessions can be backfilled with `nmem t sync --from workbuddy`; CodeBuddy uses `nmem t sync --from codebuddy`.

## Prerequisites

1. Nowledge Mem desktop app running locally, or a reachable remote Mem server.
2. WorkBuddy or CodeBuddy Code installed. For CodeBuddy Code CLI, use `npm install -g @tencent-ai/codebuddy-code`.
3. `nmem` available on the same machine as WorkBuddy or CodeBuddy. Thread sync depends on CLI support for `--from workbuddy` or `--from codebuddy`.

If `nmem` exists but rejects `t sync --from workbuddy`, `t sync --from codebuddy`, or the matching `config mcp show --host ...`, update the CLI before debugging MCP or session sync:

- Desktop-bundled CLI: open Mem and run **Settings -> Preferences -> Developer Tools -> Install bundled CLI** again.
- PyPI CLI: `python3 -m pip install --user --upgrade nmem-cli`
- pipx CLI: `pipx upgrade nmem-cli`

For remote Mem, configure the local `nmem` client on the WorkBuddy or CodeBuddy machine:

```bash
nmem config client set url https://your-mem-server
nmem config client set api-key your-key
```

## Install

Add the Nowledge community marketplace, then install the plugin:

```text
/plugin marketplace add nowledge-co/community
/plugin install nowledge-mem@nowledge-community
```

For team setup, add the marketplace and plugin to project `.workbuddy/settings.json` or `.codebuddy/settings.json` through WorkBuddy/CodeBuddy's `extraKnownMarketplaces` and `enabledPlugins` settings.

For remote Mem or authenticated localhost, generate a user-level MCP config:

```bash
nmem config mcp show --host workbuddy
# or:
nmem config mcp show --host codebuddy
```

Paste the generated block into `~/.workbuddy/.mcp.json`, `$WORKBUDDY_CONFIG_DIR/.mcp.json`, `~/.codebuddy/.mcp.json`, `$CODEBUDDY_CONFIG_DIR/.mcp.json`, or the project `.mcp.json`, depending on the scope you want.

## Automatic Thread Capture

WorkBuddy and CodeBuddy pass `session_id` and `transcript_path` to hooks. The plugin syncs the current session at these lifecycle points:

- `Stop` after a completed turn
- `SessionEnd` when the session closes
- `PreCompact` before context compression
- `SubagentStop` after a delegated subagent completes

The hook calls:

```bash
nmem --json t sync --from workbuddy --session-id <session-id> --session-dir <transcript_path> --all-projects --apply
# or:
nmem --json t sync --from codebuddy --session-id <session-id> --session-dir <transcript_path> --all-projects --apply
```

It is safe to rerun. Thread IDs come from host session IDs, message IDs are stable, and the Mem backend deduplicates reruns or partial attempts.

## Slash Commands

After installation, WorkBuddy or CodeBuddy exposes:

```text
/nowledge-mem:status
/nowledge-mem:sync-now
/nowledge-mem:import-history
```

Use `status` to check MCP and CLI connectivity, `sync-now` to import the current or most recent WorkBuddy/CodeBuddy session, and `import-history` to backfill older sessions deliberately.

## Backfill Older Sessions

Preview first:

```bash
nmem t sync --from workbuddy --limit 20
# or:
nmem t sync --from codebuddy --limit 20
```

Import when the preview looks right:

```bash
nmem t sync --from workbuddy --apply
# or:
nmem t sync --from codebuddy --apply
```

WorkBuddy stores transcripts under `$WORKBUDDY_CONFIG_DIR/projects` or `~/.workbuddy/projects`; CodeBuddy stores them under `$CODEBUDDY_CONFIG_DIR/projects` or `~/.codebuddy/projects`. This works for local and remote Mem because the CLI reads local transcript files, then uploads normalized threads to the Mem server configured in `nmem`.

## Verify

Start a new WorkBuddy or CodeBuddy session and ask:

```text
Is Nowledge Mem connected? Read my current context.
```

Then complete a short exchange and check:

```bash
nmem t list --source workbuddy -n 5
# or: nmem t list --source codebuddy -n 5
```

If hooks do not appear to run, check:

```bash
tail -n 50 ~/.workbuddy/logs/nowledge-mem-hook.log
# or: tail -n 50 ~/.codebuddy/logs/nowledge-mem-hook.log
```

## Customize Without Editing The Package

Use WorkBuddy or CodeBuddy instruction surfaces for personal behavior:

- `~/.workbuddy/CODEBUDDY.md` or `~/.codebuddy/CODEBUDDY.md` for global behavior.
- Project `CODEBUDDY.md` for shared repo behavior.
- `.workbuddy/rules/*.md` or `.codebuddy/rules/*.md` for structured rules.

Do not edit installed plugin files; marketplace updates can replace them.

## Links

- [WorkBuddy guide](https://mem.nowledge.co/docs/integrations/workbuddy)
- [CodeBuddy guide](https://mem.nowledge.co/docs/integrations/codebuddy)
- [All Connectors](https://mem.nowledge.co/docs/integrations)
- [Nowledge Mem](https://mem.nowledge.co)
