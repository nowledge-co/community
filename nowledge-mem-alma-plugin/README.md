# Nowledge Mem Alma Plugin

Local-first personal memory for [Alma](https://alma.now), powered by [Nowledge Mem](https://mem.nowledge.co).

This plugin gives Alma chat-native persistent memory:

- Search your memory graph during chats with tools
- Save structured decisions, insights, and facts with typed knowledge nodes
- Trace memories back to source conversations via sourceThreadId linkage
- Progressive retrieval: paginate through long conversation threads
- Dedup guard: prevents saving near-identical memories (>=90% similarity)
- Inject Working Memory + relevant recall context before first send
- Behavioral guidance: proactive save nudge + thread awareness in every turn
- Save thread snapshots back to Nowledge Mem on quit (optional)

All operations run locally via `nmem` CLI (or `uvx --from nmem-cli nmem` fallback).

## Requirements

- [Nowledge Mem](https://mem.nowledge.co) desktop app or `nmem` CLI
- [Alma](https://alma.now/)

## Install

1. Clone this repository:

```bash
git clone https://github.com/nowledge-co/community.git
cd community/nowledge-mem-alma-plugin
npm install
```

2. Install as a local Alma plugin:

```bash
mkdir -p ~/.config/alma/plugins/nowledge-mem
cp -R . ~/.config/alma/plugins/nowledge-mem
```

3. Restart Alma.

## Tools

| Tool | Description |
| --- | --- |
| `nowledge_mem_query` | One-shot query across memories with thread fallback. Results include `sourceThreadId`. |
| `nowledge_mem_search` | Semantic search with label/time/importance/mode filters. Results include `sourceThreadId`. |
| `nowledge_mem_store` | Save structured memory with `unit_type`, temporal fields, labels. Dedup guard at >=90%. |
| `nowledge_mem_show` | Show full memory details. Returns `sourceThreadId` when available. |
| `nowledge_mem_update` | Update memory content/title/importance |
| `nowledge_mem_delete` | Delete memory |
| `nowledge_mem_working_memory` | Read daily Working Memory (`~/ai-now/memory.md`) |
| `nowledge_mem_thread_search` | Search conversation threads with optional `source` filter |
| `nowledge_mem_thread_show` | Fetch thread messages with pagination (`offset`/`limit`). Returns `hasMore`. |
| `nowledge_mem_thread_create` | Create thread from content/messages |
| `nowledge_mem_thread_delete` | Delete thread (optional cascade) |

## Response Contract

- Search tools (`nowledge_mem_search`, `nowledge_mem_thread_search`) return:
  - `{ ok, type, query, total, items, raw }` — items may include `sourceThreadId`
- Query tool (`nowledge_mem_query`) returns:
  - `{ ok, query, source, sourceReason, total, items, raw }` — memory items include `sourceThreadId`
- Show memory returns:
  - `{ ok, item, truncated, sourceThreadId? }`
- Show thread returns:
  - `{ ok, item, totalMessages, offset, returnedMessages, hasMore, truncatedContent }`
- Store memory returns:
  - `{ ok, item, summary, raw }` (success) or `{ ok, skipped, reason, existingId, similarity }` (dedup)
- Other singleton tools (`update`, `thread_create`) return:
  - `{ ok, item, ... }`
- Delete tools return:
  - `{ ok, id, force, [cascade], notFound, item? }`
- Failure shape is normalized:
  - `{ ok: false, error: { code, operation, message } }`
  - codes: `validation_error`, `nmem_not_found`, `model_unavailable`, `not_found`, `permission_denied`, `invalid_json`, `cli_error`

## Quick Examples

- `nowledge_mem_query` input:
  - `{ "query": "python migration", "limit": 8 }`
- `nowledge_mem_query` output:
  - `{ "ok": true, "source": "memory", "sourceReason": "memory_hits", "total": 3, "items": [...] }`

- `nowledge_mem_store` input:
  - `{ "text": "Use pyproject scripts for release", "title": "Release workflow", "unit_type": "decision", "labels": ["devops","python"], "event_start": "2026-02" }`
- `nowledge_mem_store` output:
  - `{ "ok": true, "item": { "id": "...", "title": "Release workflow", "unitType": "decision", "labels": ["devops","python"], "eventStart": "2026-02" }, "summary": "Saved: Release workflow [decision] (id: ...)" }`
- `nowledge_mem_store` dedup output:
  - `{ "ok": true, "skipped": true, "reason": "duplicate", "existingId": "mem_abc", "similarity": 0.95 }`

- `nowledge_mem_delete` input (safe default):
  - `{ "id": "mem_xxx" }`
- `nowledge_mem_delete` output:
  - `{ "ok": true, "id": "mem_xxx", "force": false, "notFound": false }`

## UX Model

No modal input commands are used. The plugin is designed to stay inside normal chat flow via tool calls and hooks.

## Optional Skill Prompt

For stronger on-demand tool usage, load `alma-skill-nowledge-mem.md` into an Alma skill and enable it for chats that should prioritize external memory operations.

## Hooks

- **Auto-recall** (`chat.message.willSend`): injects Working Memory + relevant memories according to `recallPolicy`.
- Auto-recall is preloaded context, not equivalent to a successful plugin tool call in that turn.
- The injected block instructs the model to explicitly disclose when it answered from injected context only.
- **Auto-capture** (`app.willQuit`): saves active thread before Alma exits.

No plugin commands/slash actions are registered. The plugin runs through tools + hooks only.

## Configuration Policy Matrix

- `recallPolicy=off`: disable recall injection.
- `recallPolicy=balanced_thread_once` (default): inject once per thread.
- `recallPolicy=balanced_every_message`: inject before each outgoing message.
- `recallPolicy=strict_tools`: disable recall injection and rely on real `nowledge_mem_*` tools.
- `maxRecallResults`: applies in balanced modes.
- `autoCapture=true`: save current active thread on Alma quit.

Backward compatibility:

- Legacy keys (`autoRecall`, `autoRecallMode`, `recallFrequency`) are still read at runtime if `recallPolicy` is not set.

Example profiles:

- Conservative, tool-first:
  - `recallPolicy=strict_tools`
  - `autoCapture=true`
- Fast recall for brainstorming:
  - `recallPolicy=balanced_thread_once`
  - `maxRecallResults=8`
- CLI-assisted fallback (when chat tool list hides plugin tools):
  - `recallPolicy=balanced_thread_once`
  - Let model use Bash + `nmem --help` / `nmem --json ...` patterns from injected playbook

## Access Anywhere (Remote Access)

Connect to a remote Mem instance instead of `localhost`:

- **`nowledgeMem.apiUrl`**: Remote Mem API URL (e.g. `https://mem.example.com`). Leave empty for local.
- **`nowledgeMem.apiKey`**: Mem API key (`nmem_...`). Passed via environment variable only, never as a CLI argument or in logs.

Alternatively, set `NMEM_API_URL` and `NMEM_API_KEY` as environment variables before starting Alma.

Startup log shows `mode=remote` or `mode=local` to confirm which mode is active.

See [Access Mem Anywhere](https://mem.nowledge.co/docs/remote-access) for full setup instructions.

## Runtime Defaults

The plugin currently uses these defaults:

- Recall policy: `balanced_thread_once`
- Auto-capture on app quit: `false`
- Max recalled memories per injection: `5`

## License

MIT
