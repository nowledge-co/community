# Nowledge Mem Alma Plugin

Local-first personal memory for [Alma](https://alma.now), powered by [Nowledge Mem](https://mem.nowledge.co).

This plugin gives Alma chat-native persistent memory:

- Search your memory graph during chats with tools
- Save decisions and insights as long-term memories
- Inject Working Memory + relevant recall context before first send
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
| `nowledge_mem_query` | One-shot query across memories with thread fallback |
| `nowledge_mem_search` | Semantic search across memories (label/time/importance/mode filters) |
| `nowledge_mem_store` | Save memory with title/importance/labels/source |
| `nowledge_mem_show` | Show full details for one memory |
| `nowledge_mem_update` | Update memory content/title/importance |
| `nowledge_mem_delete` | Delete memory |
| `nowledge_mem_working_memory` | Read daily Working Memory (`~/ai-now/memory.md`) |
| `nowledge_mem_thread_search` | Search conversation threads |
| `nowledge_mem_thread_show` | Show one thread with messages |
| `nowledge_mem_thread_create` | Create thread from content/messages |
| `nowledge_mem_thread_delete` | Delete thread (optional cascade) |

## Response Contract

- Search tools (`nowledge_mem_search`, `nowledge_mem_thread_search`) return:
  - `{ ok, type, query, total, items, raw }`
- Query tool (`nowledge_mem_query`) returns:
  - `{ ok, query, source, sourceReason, total, items, raw }`
- Singleton tools (`show`, `store`, `update`, `thread_show`, `thread_create`) return:
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
  - `{ "text": "Use pyproject scripts for release", "title": "Release workflow", "labels": ["devops","python"] }`
- `nowledge_mem_store` output:
  - `{ "ok": true, "item": { "id": "...", "title": "Release workflow", "labels": ["devops","python"] } }`

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

## Runtime Defaults

The plugin currently uses these defaults:

- Recall policy: `balanced_thread_once`
- Auto-capture on app quit: `false`
- Max recalled memories per injection: `5`

## License

MIT
