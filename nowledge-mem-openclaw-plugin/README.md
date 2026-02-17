# Nowledge Mem OpenClaw Plugin

Local-first personal memory for [OpenClaw](https://openclaw.ai) agents, powered by [Nowledge Mem](https://mem.nowledge.co).

Gives your OpenClaw agents persistent memory. Save insights, recall relevant knowledge, and start every session with your daily Working Memory briefing. All data stays on your machine.

## Requirements

- [Nowledge Mem](https://mem.nowledge.co) desktop app **or** `nmem` CLI
- [OpenClaw](https://openclaw.ai) >= 2026.1.29

## Installation

```bash
openclaw plugins install @nowledge/openclaw-nowledge-mem
```

Plugin id in OpenClaw config: `openclaw-nowledge-mem`

In your OpenClaw config:

```json
{
  "plugins": {
    "slots": {
      "memory": "openclaw-nowledge-mem"
    },
    "entries": {
      "openclaw-nowledge-mem": {
        "enabled": true,
        "config": {
          "autoRecall": true,
          "autoCapture": false
        }
      }
    }
  }
}
```

## Tools

### memory_search (OpenClaw memory-compatible)

Compatibility recall tool for OpenClaw’s memory lifecycle. Returns structured snippets with source paths (`nowledgemem://memory/<id>`).

### memory_get (OpenClaw memory-compatible)

Reads a specific memory returned by `memory_search` (or raw memory ID) with optional line slicing.

### nowledge_mem_search

Search your personal knowledge base. Returns memories ranked by relevance.

```
Query: "React state management patterns"
→ [1] React Context vs Zustand (score: 87%)
  Use Zustand for cross-component state, Context for theme/locale...
```

### nowledge_mem_store

Save an insight, decision, or finding to your knowledge base.

```
Text: "PostgreSQL JSONB indexes require GIN, not B-tree"
Title: "PostgreSQL JSONB indexing"
Importance: 0.7
→ Memory saved: PostgreSQL JSONB indexing (id: mem_abc123)
```

### nowledge_mem_working_memory

Read your daily Working Memory briefing: focus areas, unresolved flags, and recent activity. Called automatically at session start when `autoRecall` is enabled.

## Hooks

### Auto-Recall (before_agent_start)

When `autoRecall` is enabled (default), the plugin injects context before each agent turn:

1. **Working Memory**: your daily briefing with priorities and flags
2. **Relevant memories**: semantic search based on the current prompt

### Auto-Capture (`agent_end` + `before_reset`)

When `autoCapture` is enabled, the plugin captures in three places:

1. `agent_end`: stores the latest high-signal user input as a memory note and appends the run transcript to a deterministic nmem thread
2. `after_compaction`: appends transcript chunks so compaction cycles do not lose thread continuity
3. `before_reset`: final append pass before `/new` or `/reset` clears the OpenClaw session

This uses append-first semantics (`nmem t append` / API fallback) with deterministic thread IDs and deduplication.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/remember <text>` | Save a quick memory |
| `/recall <query>` | Search your knowledge base |

## CLI Commands

```bash
# Search memories
openclaw nowledge-mem search "database optimization"

# Check status
openclaw nowledge-mem status
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoRecall` | boolean | `true` | Load Working Memory + relevant memories at session start |
| `autoCapture` | boolean | `false` | Capture durable notes on `agent_end` and append-first transcript sync on `agent_end`/`after_compaction`/`before_reset` |
| `maxRecallResults` | integer | `5` | Max memories to recall (1-20) |

## How It Works

This plugin uses the `nmem` CLI to communicate with your local Nowledge Mem instance and injects recalled context as explicit external memory for the agent. No cloud API, no API keys. Your knowledge stays on your machine.

The plugin falls back to `uvx --from nmem-cli nmem` if `nmem` is not directly on your PATH.

## License

MIT
