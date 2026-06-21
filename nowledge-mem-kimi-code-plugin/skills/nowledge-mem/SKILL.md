---
name: nowledge-mem
description: Use Nowledge Mem from Kimi Code for startup context, memory search, durable saves, thread search, and Kimi Code transcript import.
---

Nowledge Mem is the user's cross-tool memory. Use it to start with the right context, recall prior work, save durable decisions, and make Kimi Code sessions searchable from other AI tools.

## Startup Context

At the beginning of a meaningful session, or when resuming work, read Context Bundle if the Nowledge Mem MCP server is connected. It includes owner context, AI Identity, active rules, active space, and Working Memory.

If MCP is not connected, use the CLI fallback:

```bash
nmem --json context --source-app kimi-code
```

If that fails on an older `nmem`, use:

```bash
nmem --json wm read
```

Do not read both Context Bundle and Working Memory unless the user asks. Summarize only the parts relevant to the current task.

## Recall

Search memory when the user references prior work, asks for rationale, resumes a named project, investigates a regression, or asks about something that may already have been decided.

Prefer MCP when available:

- `memory_search` for durable decisions, preferences, procedures, and learnings.
- `thread_search` when the user asks about prior conversations.
- `thread_fetch_messages` only after a thread result is relevant.

CLI fallback:

```bash
nmem --json m search "what to look up"
nmem --json t search "conversation to find" --source kimi-code -n 5
```

For broad browsing across memories, threads, wiki pages, and artifacts, use the Knowledge Filesystem through MCP `mem_fs` when available, or:

```bash
nmem fs recall "topic" --in /memories -k 5
nmem fs grep "exact phrase" /threads
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
nmem --json m add "content" -t "Title" --unit-type decision -l "label" -s kimi-code -i 0.8
```

Use one strong memory instead of several weak notes.

## Save Or Import Kimi Code Threads

Real thread sync is local to the machine where Kimi Code stores its session files. MCP is not the transcript-import layer.

If the user explicitly asks to save or import Kimi Code conversations, use:

```bash
nmem --json t sync --from kimi-code --session-id <session-id> --apply
```

To backfill older Kimi Code sessions, preview first:

```bash
nmem t sync --from kimi-code --limit 20
```

Then import:

```bash
nmem t sync --from kimi-code --apply
```

This works for local and remote Nowledge Mem because `nmem` reads local Kimi Code files and uploads normalized threads to the configured Mem server.

## Status

When setup seems broken or the user asks whether Mem is connected:

```bash
nmem --json status
```

If the desktop app is on the same machine, `nmem` usually comes from the app. If Kimi Code runs on another machine, install the standalone CLI:

```bash
python3 -m pip install --user nmem-cli
```

## Space And Identity

If the host process has `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, or `NMEM_SPACE`, let `nmem` use those environment variables. Do not treat `source_app=kimi-code` as an AI Identity; it is only provenance.

## User Overrides

For personal Kimi Code behavior, use Kimi's own `AGENTS.md` surface under `$KIMI_CODE_HOME/AGENTS.md` or the project instructions. Do not edit installed plugin files under `$KIMI_CODE_HOME/plugins/managed/`.
