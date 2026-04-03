# Nowledge Mem for OpenCode

> Cross-tool knowledge, accessible in every OpenCode session. Your decisions, procedures, and context travel with you.

Nowledge Mem gives OpenCode access to knowledge from all your other AI tools: insights from Claude Code, Cursor, Codex, Gemini, ChatGPT, and every other environment you work in. One knowledge graph, available everywhere.

## What you get

- **Start every session informed.** The plugin loads your Working Memory briefing at session start: current priorities, recent decisions, open questions.
- **The agent searches for you.** When past context would improve the answer, OpenCode finds it through your knowledge graph without being asked.
- **Insights stick around.** Key decisions and learnings are saved to Nowledge Mem, ready for any future session in any tool.
- **Resumable handoffs.** Save structured session summaries that any future session in any tool can pick up from.

## Prerequisites

1. **Nowledge Mem desktop app** running (or the server accessible on port 14242)
2. **`nmem` CLI** on your PATH. In Nowledge Mem go to **Settings > Developer Tools > Install CLI**, or `pip install nmem-cli`
3. **OpenCode** installed

```bash
nmem status        # Nowledge Mem is running
opencode --version # OpenCode is available
```

## Setup

Add the plugin to your OpenCode config:

```json title="opencode.json"
{
  "plugin": ["opencode-nowledge-mem"]
}
```

Or install globally:

```json title="~/.config/opencode/opencode.json"
{
  "plugin": ["opencode-nowledge-mem"]
}
```

Restart OpenCode to load the plugin.

## Verify

Start a new OpenCode session and ask:

> What was I working on recently?

OpenCode should call `nowledge_mem_working_memory` and return your current context. If Mem is not running, you will see a connection error in the tool output.

## Update

The plugin follows OpenCode's standard plugin update mechanism. To pin a specific version:

```json
{
  "plugin": ["opencode-nowledge-mem@0.3.0"]
}
```

## Tools

| Tool | What it does |
|------|-------------|
| `nowledge_mem_working_memory` | Read today's Working Memory: focus areas, priorities, recent activity. |
| `nowledge_mem_search` | Search knowledge from all your tools. Supports label, date, and deep mode filters. |
| `nowledge_mem_save` | Save a decision, insight, or preference so any tool can find it. |
| `nowledge_mem_update` | Update an existing memory with refined information. |
| `nowledge_mem_thread_search` | Search past conversations from any tool. |
| `nowledge_mem_save_thread` | Save the current session as a full conversation thread (SDK extraction + HTTP). |
| `nowledge_mem_save_handoff` | Save a curated handoff summary (lighter, agent-composed). |
| `nowledge_mem_status` | Check Nowledge Mem server connectivity and diagnostics. |

## How session capture works

Nowledge Mem captures OpenCode sessions in three complementary ways:

1. **Background auto-sync (local mode).** The desktop app periodically polls OpenCode's session database and imports conversations based on your sync policy. Enable OpenCode in **Settings > Thread Sync**. No plugin needed for this part.

2. **Plugin full session capture.** `nowledge_mem_save_thread` reads the current session's messages via OpenCode's SDK and posts them to Nowledge Mem's thread API. Idempotent (safe to call multiple times) and handles large sessions via HTTP, not shell arguments. Works in both local and remote mode.

3. **Plugin proactive knowledge save.** `nowledge_mem_save` captures individual decisions and insights as they happen. `nowledge_mem_save_handoff` creates a curated summary at wrap-up.

**Remote mode note:** Background auto-sync (1) reads OpenCode's local SQLite database, so it only works when both tools run on the same machine. The plugin tools (2, 3) work in both local and remote mode.

## Hooks

The plugin uses two OpenCode hooks:

- **System prompt injection** (`experimental.chat.system.transform`): teaches the agent when to read Working Memory, search proactively, and save autonomously. Active on every turn.
- **Compaction resilience** (`experimental.session.compacting`): injects a reminder to restore Nowledge Mem context after long sessions trigger context compaction. Ensures the agent doesn't lose awareness of your knowledge tools.

For project-specific behavioral guidance, add to your `AGENTS.md` or OpenCode instructions. The included `AGENTS.md` in this package serves as a reference.

## Configuration

No config needed for local use.

| Env Variable | Default | What it does |
|-------------|---------|-------------|
| `NMEM_API_URL` | *(local)* | Remote Nowledge Mem server URL |
| `NMEM_API_KEY` | *(none)* | API key for remote access |

The plugin also reads `~/.nowledge-mem/config.json` (shared with all Nowledge Mem integrations). Environment variables take priority.

### Remote access

```json title="~/.nowledge-mem/config.json"
{
  "apiUrl": "https://your-server",
  "apiKey": "your-key"
}
```

See [Access Mem Anywhere](https://mem.nowledge.co/docs/remote-access).

## Troubleshooting

- **nmem not found.** Install with `pip install nmem-cli`, then run `nmem status` to verify.
- **Server not responding.** Start the Nowledge Mem desktop app, or check `nmem status` for diagnostics.
- **Plugin not loading.** Confirm `"opencode-nowledge-mem"` appears in your `opencode.json` plugin array. Restart OpenCode after changes.

## Links

- [OpenCode integration guide](https://mem.nowledge.co/docs/integrations/opencode)
- [Documentation](https://mem.nowledge.co/docs/integrations)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
