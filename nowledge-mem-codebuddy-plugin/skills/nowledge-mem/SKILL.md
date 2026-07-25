---
name: nowledge-mem
description: Use Nowledge Mem from CodeBuddy for startup context, memory and thread search, durable saves, and CodeBuddy transcript import.
---

Nowledge Mem is the user's cross-tool memory. Use it to resume with current context, recall exact prior work, save durable knowledge, and make CodeBuddy sessions searchable elsewhere.

## Startup Context

Read Context Bundle at the beginning of meaningful work or when resuming:

```bash
nmem --json context --source-app codebuddy
```

If an older CLI rejects `context`, use `nmem --json wm read`. Do not read both unless the user asks.

## Recall

Search when the user references prior work, resumes a project, investigates a regression, asks for rationale, or needs exact conversation history.

Prefer MCP:

- `memory_search` for decisions, preferences, procedures, and learnings.
- `thread_search` for prior conversations.
- `thread_fetch_messages` only after identifying a relevant thread.

CLI fallback:

```bash
nmem --json m search "what to recall"
nmem --json t search "conversation to find" --source codebuddy -n 5
```

## Save Durable Knowledge

Search before saving. Update an existing memory when the new information evolves it; add a new memory only for a durable decision, reusable procedure, stable preference, correction, or non-obvious learning.

```bash
nmem --json m search "existing concept"
nmem --json m add "content" -t "Title" --unit-type decision -l "label" -s codebuddy -i 0.8
```

## CodeBuddy Threads

Lifecycle hooks automatically sync the active transcript. For a deliberate historical import:

```bash
nmem t sync --from codebuddy --limit 20
nmem t sync --from codebuddy --apply
```

Real capture runs on the CodeBuddy machine because MCP cannot read local files under `$CODEBUDDY_CONFIG_DIR/projects` or `~/.codebuddy/projects`.

## Status

```bash
nmem --json status
```

If status succeeds but CodeBuddy-specific commands fail, update the same CLI installation before debugging hooks or MCP.

Respect `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, and `NMEM_SPACE` when present. `source_app=codebuddy` is provenance, not an AI identity.
