# Nowledge Mem for CodeBuddy

Cross-tool memory for CodeBuddy Code. Current context, durable decisions, and useful coding conversations stay available across every AI tool connected to Nowledge Mem.

## What You Get

- Context Bundle or Working Memory at session start.
- Memory and thread search through MCP, with `nmem` fallback.
- Durable memory saves.
- Automatic local transcript sync at `PreCompact`, `Stop`, `SubagentStop`, and `SessionEnd`.
- `/nowledge-mem:status`, `/nowledge-mem:sync-now`, and `/nowledge-mem:import-history`.

## Install

```bash
codebuddy plugin marketplace add nowledge-co/community
codebuddy plugin install nowledge-mem@nowledge-community
```

Restart or reload CodeBuddy. For remote Mem or authenticated localhost:

```bash
nmem config client set url https://your-mem-server
nmem config client set api-key your-key
nmem config mcp show --host codebuddy
```

Place the generated MCP block in `~/.codebuddy/.mcp.json`, `$CODEBUDDY_CONFIG_DIR/.mcp.json`, or a project `.mcp.json`.

## Thread Capture

CodeBuddy passes the active `session_id` and `transcript_path` to the connector:

```bash
nmem --json t sync --from codebuddy --session-id <session-id> --session-dir <transcript_path> --all-projects --apply
```

Repeated lifecycle events update the same thread and deduplicate messages. To backfill older sessions:

```bash
nmem t sync --from codebuddy --limit 20
nmem t sync --from codebuddy --apply
```

CodeBuddy transcripts live under `$CODEBUDDY_CONFIG_DIR/projects` or `~/.codebuddy/projects`.

## Verify

```bash
nmem status
nmem t list --source codebuddy -n 5
```

Diagnostics are written to `~/.codebuddy/logs/nowledge-mem-hook.log` unless `CODEBUDDY_CONFIG_DIR` points elsewhere.

## Customize

Use `~/.codebuddy/CODEBUDDY.md`, project `CODEBUDDY.md`, or `.codebuddy/rules/*.md`. Do not edit installed marketplace files.

## Beyond the default tools

Use the MCP tools for the day-to-day per-turn loop. For anything beyond
that -- including graph and relationship queries -- reach for the `nmem`
CLI directly (already installed alongside this plugin). We recommend it
whenever you hit a gap in the per-turn tool set:

```bash
nmem graph expand <memory-or-crystal-id> --depth 2
nmem graph evolves <memory-id>
```

Run `nmem --help` (and `nmem graph --help`, `nmem <command> --help`, etc.)
to see its full capabilities.

## Links

- [CodeBuddy guide](https://mem.nowledge.co/docs/integrations/codebuddy)
- [WorkBuddy guide](https://mem.nowledge.co/docs/integrations/workbuddy)
- [All connectors](https://mem.nowledge.co/docs/integrations)
