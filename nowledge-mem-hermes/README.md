# Nowledge Mem for Hermes Agent

> Cross-tool knowledge, accessible in every Hermes session. Your decisions, procedures, and context travel with you.

Hermes has its own memory and learning system. Nowledge Mem complements it with knowledge that spans tools: insights from Claude Code, Cursor, Codex, Gemini, and every other environment you work in. One knowledge graph, available everywhere.

## What you get

- **Start every session informed.** Hermes loads your Working Memory briefing: current priorities, recent decisions, open questions.
- **The agent searches for you.** When past context would improve the answer, Hermes finds it through your knowledge graph without being asked.
- **Insights stick around.** Key decisions and learnings are saved to Nowledge Mem, ready for any future session in any tool.
- **Full session history.** Save Hermes conversations as structured threads you can search later.

## Prerequisites

1. **Nowledge Mem desktop app** running (or the server accessible on port 14242)
2. **Hermes Agent** installed and configured

## Setup

Add the Nowledge Mem MCP server to your Hermes configuration:

```yaml title="~/.hermes/config.yaml"
mcp_servers:
  nowledge-mem:
    url: "http://127.0.0.1:14242/mcp"
    timeout: 120
```

Restart Hermes to pick up the new server.

## Verify

Start a new Hermes session and ask:

> Search my memories for recent decisions.

Hermes should call `mcp_nowledge_mem_memory_search` and return results from your knowledge graph. If Mem is not running, you will see a connection error.

## Update

The MCP server runs inside Nowledge Mem. When you update the desktop app, all MCP tools update automatically. No changes to your Hermes config needed.

## MCP tools

These tools are available to Hermes once the MCP server is connected. Hermes prefixes them as `mcp_nowledge_mem_<tool>` (see [Hermes MCP naming convention](https://hermes-agent.ai/docs/user-guide/features/overview)):

| Tool | Purpose |
|------|---------|
| `read_working_memory` | Load your daily context briefing |
| `memory_search` | Search memories and distilled knowledge |
| `memory_add` | Save a new memory |
| `memory_update` | Refine an existing memory |
| `memory_delete` | Remove a memory |
| `thread_search` | Search past conversations |
| `thread_fetch_messages` | Read messages from a specific thread |
| `thread_persist` | Save a conversation thread |
| `list_memory_labels` | Browse memory categories |

Additional tools for graph exploration, source analysis, and knowledge processing are available depending on your server configuration.

## Behavioral guidance

Hermes discovers `.hermes.md` and `HERMES.md` files by walking from the working directory upward. This means you can place guidance at two levels:

### Global (all sessions)

Create `~/HERMES.md` (or `~/.hermes.md`). When Hermes runs outside a git repository, it walks all the way to `~`, so this file provides memory behavior guidance for every session: research, writing, planning, coding, anything.

Append the contents of the included `AGENTS.md` to your `~/HERMES.md`:

```bash
cat AGENTS.md >> ~/HERMES.md
```

If you don't have a `~/HERMES.md` yet, you can use ours as a starting point:

```bash
cp AGENTS.md ~/HERMES.md
```

### Project-level (specific projects)

For project-specific guidance, append the contents to your existing project context file. Do not overwrite it, as your project instructions are valuable:

```bash
cat AGENTS.md >> /path/to/your/project/HERMES.md
```

Or if the project uses `AGENTS.md`:

```bash
cat AGENTS.md >> /path/to/your/project/AGENTS.md
```

Without behavioral guidance, the MCP tools still work, but Hermes relies on its own judgment for when to call them.

## Remote access

If Nowledge Mem runs on another machine, update the MCP server URL:

```yaml title="~/.hermes/config.yaml"
mcp_servers:
  nowledge-mem:
    url: "https://your-server:14242/mcp"
    timeout: 120
```

Ensure the remote server has API access enabled. See [Remote Access](https://mem.nowledge.co/docs/remote-access) for setup details.

## Troubleshooting

- **"Cannot connect to MCP server"**: Verify the Nowledge Mem desktop app is running and the server is listening on port 14242. Check with `curl http://127.0.0.1:14242/health`.
- **Tools not appearing**: Restart Hermes after editing `config.yaml`. Confirm the `mcp_servers` block is properly indented.
- **Slow responses**: The default timeout of 120 seconds covers deep search. If searches consistently time out, check server performance or network latency for remote setups.
- **No results from search**: Nowledge Mem may be empty. Add a few memories first through the desktop app or another integration, then try again.

## Links

- [Hermes integration guide](https://mem.nowledge.co/docs/integrations/hermes)
- [Documentation](https://mem.nowledge.co/docs/integrations)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
