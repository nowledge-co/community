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
3. **`nmem` CLI** available on PATH. If the desktop app is on the same machine, `nmem` is already bundled. Otherwise: `pip install nmem-cli`

## What the plugin does

The plugin uses Hermes' memory provider lifecycle to replace manual tool calls and behavioral guidance with deterministic hooks:

| Hook | What happens | Replaces |
|------|-------------|----------|
| `system_prompt_block` | Working Memory injected into every session automatically | Manual `read_working_memory` call |
| `prefetch` | Relevant memories searched before each turn | "Search proactively" guidance in SOUL.md |
| `on_memory_write` | User profile facts from Hermes mirrored to Nowledge Mem | Nothing (new capability) |
| `on_pre_compress` | Compressor told about external knowledge | Nothing (new capability) |
| `get_tool_schemas` | 6 native tools with clean names | MCP tools with `mcp_nowledge_mem_` prefix |

## Tools

Plugin mode exposes tools directly (no prefix):

| Tool | Purpose |
|------|---------|
| `nmem_search` | Search memories |
| `nmem_save` | Save a decision, insight, or learning |
| `nmem_update` | Refine an existing memory |
| `nmem_delete` | Remove one or more memories |
| `nmem_thread_search` | Search past conversations |
| `nmem_thread_messages` | Fetch messages from a thread |

Graph exploration tools (`neighbors`, `evolves`, `labels`) will be added when the `nmem` CLI supports them.

## Hermes memory vs Nowledge Mem

Hermes has a built-in memory system for facts within Hermes sessions. Nowledge Mem is complementary:

- **Hermes memory**: Hermes-specific preferences, tool quirks, environment details
- **Nowledge Mem**: Decisions, procedures, and learnings that future sessions in any tool should know about

The plugin's `on_memory_write` hook automatically mirrors user profile facts from Hermes to Nowledge Mem, so cross-tool knowledge stays in sync.

## Transport

The plugin shells out to the `nmem` CLI for all operations. The CLI handles server URL, API key, and remote access configuration. No duplicate config needed in the plugin.

If `nmem` is not on PATH, the plugin disables gracefully. On machines running the Nowledge Mem desktop app, `nmem` is already bundled. For remote-only setups: `pip install nmem-cli`.

## Configuration

**No plugin-level configuration needed.** The `nmem` CLI manages server URL and API key. Configure remote access via `nmem`:

```bash
nmem config set url https://your-server:14242
nmem config set api_key your-key
```

The only plugin-specific setting is request timeout, stored in `~/.hermes/nowledge-mem.json`:

```json
{
  "timeout": 30
}
```

## Verify

Start a new Hermes session. You should see Working Memory loaded in the system prompt. Ask:

> Search my memories for recent decisions.

Hermes should call `nmem_search` (plugin mode) or `mcp_nowledge_mem_memory_search` (MCP mode) and return results.

## Troubleshooting

- **"Nowledge Mem server not reachable"**: Verify the desktop app is running. Check with `nmem status`.
- **"nmem CLI not found"**: Install with `pip install nmem-cli`, or enable CLI in the desktop app: Settings > Developer Tools.
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
