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
    url: "http://localhost:14242/mcp"
    timeout: 120
```

Restart Hermes to pick up the new server.

## Verify

Start a new Hermes session and ask:

> Search my memories for recent decisions.

Hermes should call `memory_search` and return results from your knowledge graph. If Mem is not running, you will see a connection error.

## MCP tools

These tools are available to Hermes once the MCP server is connected:

| Tool | Purpose |
|------|---------|
| `read_working_memory` | Load your daily context briefing |
| `working_memory_update` | Update your Working Memory |
| `memory_search` | Search memories and distilled knowledge |
| `memory_add` | Save a new memory |
| `memory_update` | Refine an existing memory |
| `memory_get` | Retrieve a specific memory by ID |
| `memory_delete` | Remove a memory |
| `thread_search` | Search past conversations |
| `thread_fetch_messages` | Read messages from a specific thread |
| `thread_persist` | Save a conversation thread |
| `list_memory_labels` | Browse memory categories |

## Behavioral guidance (optional)

For stronger memory behavior in a specific project, copy the included `AGENTS.md` into your project root as `AGENTS.md` or `HERMES.md`. Hermes reads these files for project-level context.

```bash
cp AGENTS.md /path/to/your/project/HERMES.md
```

This tells Hermes when to search, when to save, and how to use Working Memory. Without it, the MCP tools still work, but Hermes relies on its own judgment for when to call them.

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

- **"Cannot connect to MCP server"**: Verify the Nowledge Mem desktop app is running and the server is listening on port 14242. Check with `curl http://localhost:14242/health`.
- **Tools not appearing**: Restart Hermes after editing `config.yaml`. Confirm the `mcp_servers` block is properly indented.
- **Slow responses**: The default timeout of 120 seconds covers deep search. If searches consistently time out, check server performance or network latency for remote setups.
- **No results from search**: Nowledge Mem may be empty. Add a few memories first through the desktop app or another integration, then try again.

## Links

- [Hermes integration guide](https://mem.nowledge.co/docs/integrations/hermes)
- [Documentation](/docs/integrations)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
