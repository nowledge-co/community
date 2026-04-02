# Nowledge Mem for Hermes Agent

> Cross-tool knowledge, accessible in every Hermes session. Your decisions, procedures, and context travel with you.

Hermes has its own memory and learning system. Nowledge Mem complements it with knowledge that spans tools: insights from Claude Code, Cursor, Codex, Gemini, and every other environment you work in. One knowledge graph, available everywhere.

## What you get

- **Start every session informed.** Hermes loads your Working Memory briefing: current priorities, recent decisions, open questions.
- **The agent searches for you.** When past context would improve the answer, Hermes finds it through your knowledge graph without being asked.
- **Insights stick around.** Key decisions and learnings are saved to Nowledge Mem, ready for any future session in any tool.
- **Session handoff.** Save Hermes conversations as structured threads you can search later. What gets captured depends on Hermes' session context capabilities.

## Prerequisites

1. **Nowledge Mem desktop app** running (or the server accessible on port 14242)
2. **Hermes Agent** installed and configured

## Setup

Two steps: connect the MCP server, then teach Hermes when to use it.

### Step 1: MCP server

Add the Nowledge Mem MCP server to your Hermes configuration:

```yaml title="~/.hermes/config.yaml"
mcp_servers:
  nowledge-mem:
    url: "http://127.0.0.1:14242/mcp"
    timeout: 120
```

### Step 2: Behavioral guidance (required)

Without this step, Hermes sees the tools but does not know when to save knowledge proactively. Run:

```bash
# If you already have a ~/HERMES.md, append:
cat AGENTS.md >> ~/HERMES.md

# If you don't have one yet:
cp AGENTS.md ~/HERMES.md
```

Or use the setup script, which handles both steps safely:

```bash
./setup.sh
```

Restart Hermes after both steps.

> **Why is this required?** Hermes discovers behavioral guidance from `HERMES.md` files, not from MCP tool descriptions alone. Without the guidance, Hermes can recall memories when asked, but will not proactively save decisions, search for context, or load your Working Memory briefing at session start. This is the most common setup issue.

### Project-level guidance

For project-specific guidance, append the contents to your existing project context file:

```bash
cat AGENTS.md >> /path/to/your/project/HERMES.md
```

Or if the project uses `AGENTS.md`:

```bash
cat AGENTS.md >> /path/to/your/project/AGENTS.md
```

## Verify

Start a new Hermes session and ask:

> Search my memories for recent decisions.

Hermes should call `mcp_nowledge_mem_memory_search` and return results from your knowledge graph. If Mem is not running, you will see a connection error.

Then test proactive save by making a decision in conversation. Hermes should save it to Nowledge Mem without being asked. If it doesn't, confirm Step 2 is complete.

## Update

The MCP server runs inside Nowledge Mem. When you update the desktop app, all MCP tools update automatically. No changes to your Hermes config needed.

## Hermes memory vs Nowledge Mem

Hermes has a built-in memory system for facts within Hermes sessions. Nowledge Mem is complementary: it stores knowledge that spans tools. Use both:

- **Hermes memory**: Hermes-specific preferences, tool quirks, environment details
- **Nowledge Mem**: Decisions, procedures, and learnings that future sessions in any tool should know about

The behavioral guidance in AGENTS.md teaches Hermes to distinguish between the two.

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
- **Hermes recalls but never saves**: Step 2 (behavioral guidance) is missing. Run `cat AGENTS.md >> ~/HERMES.md` and restart Hermes.
- **Slow responses**: The default timeout of 120 seconds covers deep search. If searches consistently time out, check server performance or network latency for remote setups.
- **No results from search**: Nowledge Mem may be empty. Add a few memories first through the desktop app or another integration, then try again.

## Links

- [Hermes integration guide](https://mem.nowledge.co/docs/integrations/hermes)
- [Documentation](https://mem.nowledge.co/docs/integrations)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
