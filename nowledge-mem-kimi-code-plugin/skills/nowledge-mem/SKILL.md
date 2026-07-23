---
name: nowledge-mem
description: Use Nowledge Mem from Kimi Code for startup context, memory search, durable saves, thread search, and Kimi Code transcript import.
---

Nowledge Mem is the user's cross-tool memory. Use it to start with the right context, recall prior work, save durable decisions, and make Kimi Code sessions searchable from other AI tools.

## Startup Context

At the beginning of a meaningful session, or when resuming work, read Context Bundle through the CLI first:

```bash
nmem --json context --source-app kimi-code
```

This is intentional. Kimi Code's current remote MCP configuration accepts static HTTP headers but cannot map arbitrary process environment variables into headers. The CLI reads `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, and `NMEM_SPACE` from the current Kimi process, so a named Raft/Kimi worker receives the correct AI Identity, Rules, default Space, and Working Memory.

Keep the non-empty `authorship.agent_id`, `authorship.host_agent_id`, and `active_space.primary_space_id` returned by Context Bundle for this session. Pass them as `agent_id`, `host_agent_id`, and `space_id` on later Nowledge Mem MCP calls. Never derive an identity from `source_app`.

If the CLI is unavailable but MCP is connected, call MCP `read_context_bundle`. If both are unavailable, use:

```bash
nmem --json wm read
```

Do not read both Context Bundle and Working Memory unless the user asks. Summarize only the parts relevant to the current task.

If `nmem` exists but rejects a Kimi Code command, flag, or MCP host helper, treat it as an outdated CLI rather than a broken Mem server. Check `nmem --version`, refresh the CLI from the same source, then retry. For the desktop-bundled CLI, ask the user to open Mem and run Settings -> Preferences -> Developer Tools -> Install bundled CLI. For standalone installs, use `python3 -m pip install --user --upgrade nmem-cli` or `pipx upgrade nmem-cli`.

## Recall

Search memory when the user references prior work, asks for rationale, resumes a named project, investigates a regression, or asks about something that may already have been decided.

Prefer MCP when available:

- `memory_search` for durable decisions, preferences, procedures, and learnings.
- `thread_search` when the user asks about prior conversations.
- `thread_fetch_messages` only after a thread result is relevant.

When startup Context Bundle returned an AI Identity or active Space, pass those
exact values on MCP search/read calls whose tool schema exposes the corresponding
`agent_id`, `host_agent_id`, or `space_id` argument.

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

When startup Context Bundle returned an AI Identity or active Space, pass those
exact values on MCP writes whose tool schema exposes the corresponding identity
or Space argument. The server normalizes an explicit portable `agent_id`,
enrolls its profile once, and stores the attribution with a new Memory.

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

If `nmem --json status` works but Kimi-specific commands fail, do not keep using the old CLI. Upgrade it first, then rerun the failed command.

If the desktop app is on the same machine, `nmem` usually comes from the app. If Kimi Code runs on another machine, install the standalone CLI:

```bash
python3 -m pip install --user nmem-cli
```

## Space And Identity

If the host process has `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, or `NMEM_SPACE`, let `nmem` use those environment variables and retain the resolved Context Bundle values for MCP calls. Do not treat `source_app=kimi-code` as an AI Identity; it is only provenance.

## User Overrides

For personal Kimi Code behavior, use Kimi's own `AGENTS.md` surface under `$KIMI_CODE_HOME/AGENTS.md` or the project instructions. Do not edit installed plugin files under `$KIMI_CODE_HOME/plugins/managed/`.
