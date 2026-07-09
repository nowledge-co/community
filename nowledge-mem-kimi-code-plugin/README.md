# Nowledge Mem for Kimi Code

Cross-tool memory for Kimi Code. Your decisions, preferences, procedures, and useful coding conversations stay searchable across every AI tool connected to Nowledge Mem.

## What You Get

- Kimi Code can read Context Bundle / Working Memory before important work.
- Kimi Code can search memories and prior threads through MCP, with `nmem` CLI fallback.
- Kimi Code can save durable decisions and procedures into Nowledge Mem.
- Kimi Code conversations sync into Mem Threads through native plugin lifecycle hooks.
- Kimi Code subagent work is picked up through `SubagentStop` plus `agents/*/wire.jsonl` import support.
- Quick commands are available as `/nowledge-mem:status`, `/nowledge-mem:sync-now`, and `/nowledge-mem:import-history`.
- Older Kimi Code sessions can be backfilled with `nmem t sync --from kimi-code`.

## Prerequisites

1. Nowledge Mem desktop app running locally, or a reachable remote Mem server.
2. Kimi Code installed.
3. `nmem` 0.9.19 or newer available on the same machine as Kimi Code. Kimi Code thread sync depends on the CLI support for `--from kimi-code`.

If the Nowledge Mem desktop app is on the same machine, install the CLI from the app:

```bash
nmem status
nmem --version
```

If `nmem` exists but rejects `t sync --from kimi-code`, `config mcp show --host kimi-code`, or another Kimi-specific command, update the CLI before debugging MCP or session sync:

- Desktop-bundled CLI: open Mem and run **Settings -> Preferences -> Developer Tools -> Install bundled CLI** again.
- PyPI CLI: `python3 -m pip install --user --upgrade nmem-cli`
- pipx CLI: `pipx upgrade nmem-cli`

If Kimi Code runs on another machine, install the standalone CLI there:

```bash
python3 -m pip install --user nmem-cli
nmem status
nmem --version
```

For remote Mem, configure the local `nmem` client on the Kimi Code machine:

```bash
nmem config client set url https://your-mem-server
nmem config client set api-key your-key
```

## Install

Install the Kimi Code plugin from the community repo:

```text
/plugins install https://github.com/nowledge-co/community
/plugins enable nowledge-mem
/reload
```

The plugin bundles:

- a session-start skill
- a local MCP server declaration for `http://127.0.0.1:14242/mcp/`
- native lifecycle hooks for `Stop`, `SessionEnd`, `PreCompact`, `SubagentStop`, and `Interrupt`
- slash commands under `/nowledge-mem:*`

Kimi namespaces plugin MCP servers, so this does not overwrite user-level MCP entries.

The community repo has a root `kimi.plugin.json` shim that points Kimi Code to this package directory. Kimi's GitHub installer downloads the repository zip; it does not clone submodules. If you are developing locally or need an offline install, you can still install from the package directory:

```bash
git clone --depth 1 https://github.com/nowledge-co/community.git ~/.cache/nowledge-community
```

```text
/plugins install ~/.cache/nowledge-community/nowledge-mem-kimi-code-plugin
/plugins enable nowledge-mem
/reload
```

For remote Mem or authenticated localhost, generate a user-level MCP config with the version of `nmem` that includes Kimi Code support:

```bash
nmem config mcp show --host kimi-code
```

Paste the generated block into `$KIMI_CODE_HOME/mcp.json` or `~/.kimi-code/mcp.json`, then start a new Kimi Code session.

If your installed `nmem` does not recognize `--host kimi-code` yet, update `nmem-cli` first. As a temporary fallback, add the generic streamable HTTP MCP block from the Mem docs and set the URL/API key manually.

## Automatic Thread Capture

Modern Kimi Code reads the hook declarations from `kimi.plugin.json`. After `/plugins install`, `/plugins enable nowledge-mem`, and `/reload`, the plugin syncs the current session at these lifecycle points:

- `Stop` after a completed turn
- `SessionEnd` when the session closes
- `PreCompact` before context compression
- `SubagentStop` after a delegated subagent completes
- `Interrupt` when a turn is interrupted

The hook calls:

```bash
nmem --json t sync --from kimi-code --session-id <session-id> --apply
```

It is safe to rerun. Thread IDs come from Kimi Code session IDs, message IDs are stable, and the Mem backend deduplicates reruns or partial attempts.

If you are on an older Kimi Code build that does not load plugin manifest hooks, run the host-level fallback installer once after installing or updating this package:

```bash
python3 ~/.cache/nowledge-community/nowledge-mem-kimi-code-plugin/scripts/install_hooks.py
```

The installer:

- Copies `scripts/kimi-sync-hook.py` to `$KIMI_CODE_HOME/hooks/nowledge-mem-sync-hook.py`.
- Backs up `$KIMI_CODE_HOME/config.toml`.
- Adds one managed hook block for `Stop`, `SessionEnd`, `PreCompact`, `SubagentStop`, and `Interrupt`.
- Leaves existing Kimi Code config and hooks outside the managed block untouched.

Do not run both the manifest hooks and the fallback installer unless you need host-level config intentionally. If both paths fire, `nmem` and Mem still deduplicate repeated imports, but you may see duplicate hook log lines.

## Slash Commands

After `/reload`, Kimi Code exposes these commands:

```text
/nowledge-mem:status
/nowledge-mem:sync-now
/nowledge-mem:import-history
```

Use `status` to check MCP and CLI connectivity, `sync-now` to import the current or most recent Kimi Code session, and `import-history` to backfill older sessions deliberately.

## Backfill Older Sessions

Preview first:

```bash
nmem t sync --from kimi-code --limit 20
```

Import when the preview looks right:

```bash
nmem t sync --from kimi-code --apply
```

This works for local and remote Mem because the CLI reads Kimi Code's local session files under `$KIMI_CODE_HOME/sessions` or `~/.kimi-code/sessions`, then uploads normalized threads to the Mem server configured in `nmem`.

## Verify

Start a new Kimi Code session and ask:

```text
Is Nowledge Mem connected? Read my current context.
```

Then complete a short exchange and check:

```bash
nmem t list --source kimi-code -n 5
```

If hooks do not appear to run, check:

```bash
tail -n 50 ~/.kimi-code/logs/nowledge-mem-hook.log
```

## Update

Reinstall the plugin package from the new source, run `/reload`, and start a new session if needed:

```text
/plugins install https://github.com/nowledge-co/community
/plugins enable nowledge-mem
/reload
```

Only rerun `scripts/install_hooks.py` when you are using the older host-level fallback hook setup.

## Customize Without Editing The Package

Use Kimi Code's own instruction surfaces for personal behavior:

- `$KIMI_CODE_HOME/AGENTS.md` for global Kimi-specific behavior.
- Project instructions for repo-specific rules.

Do not edit files under `$KIMI_CODE_HOME/plugins/managed/`; those are managed copies and can be replaced by Kimi Code updates.

## Links

- [Kimi Code guide](https://mem.nowledge.co/docs/integrations/kimi-code)
- [All Connectors](https://mem.nowledge.co/docs/integrations)
- [Nowledge Mem](https://mem.nowledge.co)
