---
name: nowledge-mem
description: Use Nowledge Mem from WorkBuddy for current context, memory and thread search, durable saves, and WorkBuddy transcript import.
---

Nowledge Mem is the user's current cross-tool memory. Use it to resume with relevant context, recall exact prior work, save durable knowledge, and make WorkBuddy sessions available in other connected AI tools.

## Start With Context

At the beginning of meaningful work or when resuming, read Context Bundle through the Nowledge Mem MCP server. The SessionStart hook normally provides it automatically.

CLI fallback:

```bash
nmem --json context --source-app workbuddy
```

If an older CLI rejects `context`, use:

```bash
nmem --json wm read
```

Do not read both unless the user asks. Use only the parts relevant to the task.

## Recall

Search Nowledge Mem when the user refers to prior work, resumes a project, investigates a regression, asks why a decision was made, or needs exact conversation history. WorkBuddy-local memory is not a substitute for current cross-tool context or sourced history.

Prefer MCP:

- `memory_search` for durable decisions, preferences, procedures, and learnings.
- `thread_search` for prior conversations.
- `thread_fetch_messages` only after identifying a relevant thread.

CLI fallback:

```bash
nmem --json m search "what to recall"
nmem --json t search "conversation to find" --source workbuddy -n 5
```

## Save Durable Knowledge

Save meaningful decisions, reusable procedures, stable preferences, corrections, and non-obvious learnings. Search first to avoid duplicates.

Prefer MCP:

1. `memory_search` for an existing memory.
2. `memory_update` when the new information evolves it.
3. `memory_add` for new durable knowledge.

CLI fallback:

```bash
nmem --json m search "existing concept"
nmem --json m add "content" -t "Title" --unit-type decision -l "label" -s workbuddy -i 0.8
```

## WorkBuddy Threads

Lifecycle hooks automatically sync the active transcript at `PreCompact`, `Stop`, `SubagentStop`, and `SessionEnd`. Real transcript capture runs on the WorkBuddy machine; MCP is not a transcript importer.

For a deliberate historical import, preview first:

```bash
nmem t sync --from workbuddy --limit 20
```

Then apply:

```bash
nmem t sync --from workbuddy --apply
```

WorkBuddy transcripts live under `$WORKBUDDY_CONFIG_DIR/projects` or `~/.workbuddy/projects`. The CLI can upload them to either local or remote Mem through the user's configured endpoint.

## Status

When setup seems broken:

```bash
nmem --json status
```

If status succeeds but WorkBuddy-specific commands fail, update the same CLI installation before debugging hooks or MCP.

## Space And Identity

Respect `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, and `NMEM_SPACE` when present. `source_app=workbuddy` records provenance; it is not an AI identity.

## User Overrides

Use WorkBuddy-owned `CODEBUDDY.md` and `.workbuddy/rules/*.md` surfaces for personal behavior. Do not edit installed marketplace files because updates replace them.
