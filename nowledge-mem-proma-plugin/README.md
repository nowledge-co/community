# Nowledge Mem Plugin for Proma

Integrates Nowledge Mem's personal knowledge graph into Proma, providing persistent cross-session memory through MCP tools, lifecycle hooks, and a companion skill.

## Prerequisites

- [Proma](https://proma.ai) desktop app or CLI
- Nowledge Mem server running (desktop app or remote)
- Python 3.9+ (for hook scripts)
- `nmem` CLI in PATH (bundled with [Nowledge Mem desktop app](https://mem.nowledge.co/), or `pip install nmem-cli`)

## Installation

### 1. Configure MCP Server

Add the Nowledge Mem MCP server to your Proma workspace `mcp.json`:

**Path:** `~/.proma/agent-workspaces/default/mcp.json`

```json
{
  "servers": {
    "nowledge-mem": {
      "url": "http://127.0.0.1:14242/mcp/",
      "type": "streamableHttp",
      "headers": {
        "APP": "Proma",
        "Authorization": "Bearer <your-nmem-api-key>",
        "X-NMEM-API-Key": "<your-nmem-api-key>"
      }
    }
  }
}
```

For remote Mem setups, replace the URL with your remote server (e.g., `https://mem.example.com/mcp/`).

### 2. Install Hook Scripts

Copy the hook scripts to your Proma hooks directory:

```bash
mkdir -p ~/.proma/hooks/
cp hooks/save-to-nmem.py ~/.proma/hooks/
cp hooks/read-working-memory.py ~/.proma/hooks/
```

### 3. Enable Lifecycle Hooks

Merge the hooks configuration from `hooks/hooks.json` into `~/.proma/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python \"<proma-home>/hooks/save-to-nmem.py\"",
            "timeout": 30,
            "async": true
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python \"<proma-home>/hooks/read-working-memory.py\"",
            "timeout": 10,
            "async": true
          }
        ]
      }
    ]
  }
}
```

Replace `<proma-home>` with your actual Proma home path (usually `~/.proma` on macOS/Linux or `C:\Users\<user>\.proma` on Windows).

### 4. Install the Skill

Copy the nmem skill to your Proma workspace:

```bash
mkdir -p ~/.proma/agent-workspaces/default/skills/nmem/
cp skills/nmem/SKILL.md ~/.proma/agent-workspaces/default/skills/nmem/
```

### 5. (Recommended) Add CLAUDE.md Guidance

Add the following guidance to your CLAUDE.md so Proma knows when to use nmem vs built-in memory:

```markdown
## Nowledge Mem (nmem) Usage

When nmem MCP tools (`mcp__nowledge-mem__*`) are available:

- **Cross-session persistence** -> nmem (`mcp__nowledge-mem__add_memory`)
- **Within-session context** -> built-in `mcp__mem__*`
- **Historical decisions, past discussions** -> `mcp__nowledge-mem__search_memories`
- **Session archiving** -> `mcp__nowledge-mem__save_thread`

**Proactive behaviors:**
- Read Working Memory at session start
- Distill key decisions to nmem Memories
- When user says "before", "last time": search nmem + built-in memory
```

### 6. Restart Proma

Restart Proma for the MCP server and hooks to take effect. Verify with `/nmem-status` in a new session.

## Architecture

```
Proma Agent
  |
  |-- mcp.json  -->  nmem MCP server (tools: search, save, status)
  |-- Stop Hook -->  save-to-nmem.py   (auto-capture sessions)
  |-- SessionStart Hook --> read-working-memory.py (inject context)
  |-- nmem Skill --> /nmem-save, /nmem-search, /nmem-status
```

## How It Works

1. **MCP Tools** — `mcp__nowledge-mem__*` tools are available to the agent for on-demand memory operations: search past decisions, save new learnings, read working memory.
2. **Stop Hook** — After every agent response, `save-to-nmem.py` parses the current Proma session JSONL (`~/.proma/agent-sessions/<id>.jsonl`) and uploads the messages to nmem's thread store via REST API.
3. **SessionStart Hook** — On new or resumed sessions, `read-working-memory.py` calls `nmem wm read` and outputs the briefing for context injection.
4. **Skill** — Slash commands provide manual control as a fallback.

### Session Format

Proma stores sessions as JSONL files in `~/.proma/agent-sessions/`. Each line is a JSON object with:
- `type`: `"user"` or `"assistant"`
- `message.content`: array of content blocks (text, tool_use, tool_result, thinking)
- `uuid`: unique message identifier

The save script deduplicates by UUID and extracts human-readable text from content blocks.

## Configuration

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `NMEM_API_URL` | nmem server URL | From `~/.nowledge-mem/config.json` |
| `NMEM_API_KEY` | nmem API key | From `~/.nowledge-mem/config.json` |
| `PROMA_HOME` | Proma home directory | `~/.proma` |

The hook scripts read credentials from standard nmem config (`~/.nowledge-mem/config.json`), so no duplicate configuration is needed if nmem is already set up on the machine.

## Troubleshooting

**MCP tools not showing up:**
- Verify `mcp.json` uses `"servers"` (not `"mcpServers"`) as the top-level key
- Check the API URL and key are correct
- Restart Proma after changing `mcp.json`

**Hooks not firing:**
- Check `~/.proma/log/nmem-hook.log` for errors
- Verify Python 3.9+ is installed and in PATH
- Ensure hook commands use correct absolute paths

**"nmem CLI not found":**
- Install via `pip install nmem-cli` or the Nowledge Mem desktop app
- Verify `nmem --version` works in your terminal

**Session not saved:**
- Run the save script manually: `echo '{"session_id":"<id>"}' | python hooks/save-to-nmem.py`
- Check the log at `~/.proma/log/nmem-hook.log`
