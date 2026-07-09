---
name: nowledge-mem
description: Use Nowledge Mem from WorkBuddy or CodeBuddy for startup context, memory search, durable saves, thread search, and WorkBuddy/CodeBuddy transcript import.
---

Nowledge Mem is the user's cross-tool memory. Use it to start with relevant context, recall prior work, save durable decisions, and make WorkBuddy and CodeBuddy sessions searchable from other AI tools.

## Startup Context

At the beginning of meaningful work or when resuming, read Context Bundle if the Nowledge Mem MCP server is connected. It includes owner context, AI Identity, active rules, active space, and Working Memory.

CLI fallback:

```bash
nmem --json context --source-app workbuddy
```

If that fails on an older CLI, use:

```bash
nmem --json wm read
```

Do not read both Context Bundle and Working Memory unless the user asks. Summarize only the parts relevant to the current task.

## Recall

Search memory when the user references prior work, resumes a named project, investigates a regression, asks for rationale, or makes a decision that may depend on history.

Prefer MCP when available:

- `memory_search` for durable decisions, preferences, procedures, and learnings.
- `thread_search` when the user asks about prior conversations.
- `thread_fetch_messages` only after a thread result is relevant.

CLI fallback:

```bash
nmem --json m search "what to look up"
nmem --json t search "conversation to find" --source workbuddy -n 5
```

## Save Durable Knowledge

When a meaningful decision, reusable procedure, user preference, correction, or non-obvious lesson appears, save it. Search first to avoid duplicates.

Prefer MCP:

1. `memory_search` for an existing memory.
2. `memory_update` if the existing memory should evolve.
3. `memory_add` for a new durable memory.

CLI fallback:

```bash
nmem --json m search "existing concept"
nmem --json m add "content" -t "Title" --unit-type decision -l "label" -s workbuddy -i 0.8
```

## Save Or Import WorkBuddy/CodeBuddy Threads

Real thread sync is local to the machine where WorkBuddy or CodeBuddy stores its transcript files. MCP is not the transcript-import layer.

The plugin hook automatically runs after WorkBuddy/CodeBuddy lifecycle events. If the user explicitly asks to save or import WorkBuddy or CodeBuddy conversations, preview first:

```bash
nmem t sync --from workbuddy --limit 20
```

Then import:

```bash
nmem t sync --from workbuddy --apply
```

If the user provides a specific session id:

```bash
nmem --json t sync --from workbuddy --session-id <session-id> --apply
```

This works for local and remote Nowledge Mem because `nmem` reads local WorkBuddy files under `$WORKBUDDY_CONFIG_DIR/projects` or `~/.workbuddy/projects`; use `--from codebuddy` for CodeBuddy under `$CODEBUDDY_CONFIG_DIR/projects` or `~/.codebuddy/projects`, then uploads normalized threads to the configured Mem server.

## Status

When setup seems broken or the user asks whether Mem is connected:

```bash
nmem --json status
```

If `nmem --json status` works but WorkBuddy/CodeBuddy-specific commands fail, upgrade the CLI from the same source first, then rerun the failed command.

## Space And Identity

If the host process has `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, or `NMEM_SPACE`, let `nmem` use those environment variables. Do not treat `source_app=workbuddy` or `source_app=codebuddy` as an AI Identity; it is only provenance.

## User Overrides

For personal WorkBuddy or CodeBuddy behavior, use WorkBuddy/CodeBuddy owned `CODEBUDDY.md`, `.workbuddy/rules/*.md`, or `.codebuddy/rules/*.md` surfaces. Do not edit installed plugin files; marketplace updates can replace them.
