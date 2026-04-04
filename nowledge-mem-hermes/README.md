# Nowledge Mem for Hermes Agent

> Cross-tool knowledge, accessible in every Hermes session. Your decisions, procedures, and context travel with you.

Hermes has its own memory and learning system. Nowledge Mem complements it with knowledge that spans tools: insights from Claude Code, Cursor, Codex, Gemini, and every other environment you work in. One knowledge graph, available everywhere.

## Install

### Plugin (recommended, Hermes v0.7.0+)

The plugin integrates at the memory-provider level: Working Memory loads automatically, relevant memories are recalled before every turn, and tools use clean names without the `mcp_` prefix.

```bash
bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh)
```

Or with the interactive setup:

```bash
hermes memory setup
# Select: nowledge-mem
```

Or manually:

1. Copy plugin files to `~/.hermes/plugins/memory/nowledge-mem/`:
   ```bash
   mkdir -p ~/.hermes/plugins/memory/nowledge-mem
   cd ~/.hermes/plugins/memory/nowledge-mem
   for f in plugin.yaml __init__.py provider.py client.py; do
     curl -sLO "https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/$f"
   done
   ```
2. Set the provider in `~/.hermes/config.yaml`:
   ```yaml
   memory:
     provider: "nowledge-mem"
   ```
3. Restart Hermes.

### MCP only (any Hermes version)

If you prefer the standard MCP connection or are on Hermes < v0.7.0:

```bash
bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh) --mcp
```

This adds the MCP server to `config.yaml` and installs behavioral guidance in `~/.hermes/SOUL.md`. Tools appear with the `mcp_nowledge_mem_` prefix.

## Prerequisites

1. **Nowledge Mem desktop app** running (or the server accessible on port 14242)
2. **Hermes Agent** installed and configured

## What the plugin does

The plugin uses Hermes' memory provider lifecycle to replace manual tool calls and behavioral guidance with deterministic hooks:

| Hook | What happens | Replaces |
|------|-------------|----------|
| `system_prompt_block` | Working Memory injected into every session automatically | Manual `read_working_memory` call |
| `prefetch` | Relevant memories searched before each turn | "Search proactively" guidance in SOUL.md |
| `on_memory_write` | User profile facts from Hermes mirrored to Nowledge Mem | Nothing (new capability) |
| `on_pre_compress` | Compressor told about external knowledge | Nothing (new capability) |
| `get_tool_schemas` | 9 native tools with clean names | MCP tools with `mcp_nowledge_mem_` prefix |

## Tools

Plugin mode exposes tools directly (no prefix):

| Tool | Purpose |
|------|---------|
| `nmem_search` | Search memories or list recent |
| `nmem_save` | Save a decision, insight, or learning |
| `nmem_update` | Refine an existing memory |
| `nmem_delete` | Remove one or more memories |
| `nmem_labels` | List labels with usage counts |
| `nmem_thread_search` | Search past conversations |
| `nmem_thread_messages` | Fetch messages from a thread |
| `nmem_neighbors` | Discover related memories via graph |
| `nmem_evolves` | Trace how a decision changed over time |

## Hermes memory vs Nowledge Mem

Hermes has a built-in memory system for facts within Hermes sessions. Nowledge Mem is complementary:

- **Hermes memory**: Hermes-specific preferences, tool quirks, environment details
- **Nowledge Mem**: Decisions, procedures, and learnings that future sessions in any tool should know about

The plugin's `on_memory_write` hook automatically mirrors user profile facts from Hermes to Nowledge Mem, so cross-tool knowledge stays in sync.

## Transport

The plugin uses a dual-transport client: it prefers the `nmem` CLI when installed (handles auth, remote URL, API key), and falls back to direct HTTP REST when the CLI is not available. Most tools work through either transport. A few (labels listing, graph exploration) always use HTTP.

## Configuration

The plugin reads configuration from (in priority order):

1. Environment variables: `NOWLEDGE_MEM_URL`, `NOWLEDGE_MEM_API_KEY`
2. Config file: `$HERMES_HOME/nowledge-mem.json`
3. Default: `http://127.0.0.1:14242`

For remote access:

```json
{
  "url": "https://your-server:14242",
  "api_key": "your-api-key",
  "timeout": 60
}
```

Save to `~/.hermes/nowledge-mem.json`, or run `hermes memory setup` and enter the URL when prompted.

## Verify

Start a new Hermes session. You should see Working Memory loaded in the system prompt. Ask:

> Search my memories for recent decisions.

Hermes should call `nmem_search` (plugin mode) or `mcp_nowledge_mem_memory_search` (MCP mode) and return results.

## Troubleshooting

- **"Nowledge Mem server not reachable"**: Verify the desktop app is running. Check with `curl http://127.0.0.1:14242/health`.
- **Tools not appearing (plugin)**: Confirm `memory.provider: "nowledge-mem"` in config.yaml and plugin files exist in `~/.hermes/plugins/memory/nowledge-mem/`. Restart Hermes.
- **Tools not appearing (MCP)**: Confirm `mcp_servers.nowledge-mem` block in config.yaml. Restart Hermes.
- **Hermes recalls but never saves**: In MCP mode, behavioral guidance may be missing from SOUL.md. In plugin mode, the guidance is built-in; check that the plugin loaded with `hermes memory status`.
- **Slow responses**: Default timeout is 30 seconds. Increase in `nowledge-mem.json` for remote setups.

## Update

The MCP tools are defined by the Nowledge Mem server. When you update the desktop app, tool capabilities update automatically. For plugin updates, re-run the setup command.

## Links

- [Hermes integration guide](https://mem.nowledge.co/docs/integrations/hermes)
- [Documentation](https://mem.nowledge.co/docs/integrations)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
