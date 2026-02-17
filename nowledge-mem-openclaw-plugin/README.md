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

In your OpenClaw config:

```json
{
  "plugins": {
    "entries": {
      "nowledge-mem": {
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

### Auto-Capture (agent_end)

`nmem-cli` currently does not support an OpenClaw-native thread append/save flow.  
When `autoCapture` is enabled, the plugin logs a warning and skips capture.

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
| `autoCapture` | boolean | `false` | Reserved (logs warning; capture skipped) |
| `maxRecallResults` | integer | `5` | Max memories to recall (1-20) |

## How It Works

This plugin uses the `nmem` CLI to communicate with your local Nowledge Mem instance and injects recalled context as explicit external memory for the agent. No cloud API, no API keys. Your knowledge stays on your machine.

The plugin falls back to `uvx --from nmem-cli nmem` if `nmem` is not directly on your PATH.

## License

MIT
