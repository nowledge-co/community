# Nowledge Mem Alma Plugin

Local-first personal memory for [Alma](https://alma.now), powered by [Nowledge Mem](https://mem.nowledge.co).

This plugin gives Alma persistent memory tools:

- Search your memory graph during chats
- Save decisions and insights as memories
- Load Working Memory context at session start
- Save thread snapshots back to Nowledge Mem

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

2. Install as a local Alma plugin (via Alma plugin manager / local plugin path).
3. Restart Alma.

## Tools

| Tool | Description |
| --- | --- |
| `nowledge_mem_search` | Semantic search across memories |
| `nowledge_mem_store` | Save memory with optional title and importance |
| `nowledge_mem_working_memory` | Read daily Working Memory (`~/ai-now/memory.md`) |

## Commands

| Command | Description |
| --- | --- |
| `Nowledge Mem: Check Status` | Verify connection to local `nmem` |
| `Nowledge Mem: Search Memory` | Prompt for query and search |
| `Nowledge Mem: Save Memory` | Prompt and save one memory |
| `Nowledge Mem: Read Working Memory` | Check Working Memory availability |
| `Nowledge Mem: Save Current Thread` | Save active Alma thread |

## Hooks

- **Auto-recall** (`chat.message.willSend`): injects Working Memory + relevant memories on first outgoing message of each thread.
- **Auto-capture** (`app.willQuit`): saves active thread before Alma exits.

## Configuration

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `nowledgeMem.autoRecall` | boolean | `true` | Inject context at first message in each thread |
| `nowledgeMem.autoCapture` | boolean | `false` | Save active thread when Alma quits |
| `nowledgeMem.maxRecallResults` | number | `5` | Max recalled memories (1-20) |

## License

MIT
