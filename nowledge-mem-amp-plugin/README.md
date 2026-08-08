# Nowledge Mem for Amp

> Cross-tool knowledge, accessible in every Amp session. Your decisions, procedures, and context travel with you.

Nowledge Mem gives Amp access to knowledge from all your other AI tools: insights from Claude Code, Cursor, Codex, Gemini, ChatGPT, and every other environment you work in. One knowledge graph, available everywhere.

## What you get

- **Start every session informed.** The plugin injects your Context Bundle at the start of each agent turn: owner identity, AI Identity, active space, active rules, and Working Memory.
- **The agent searches for you.** When past context would improve the answer, Amp finds it through your knowledge graph without being asked.
- **Explore the knowledge graph.** Expand any memory to see its neighbours and the labelled edges connecting them.
- **Insights stick around.** Key decisions and learnings are saved to Nowledge Mem, ready for any future session in any tool.
- **Sessions are captured automatically.** At the end of each agent turn, the plugin saves the conversation as a searchable Mem thread.
- **Resumable handoffs.** Save structured session summaries that any future session in any tool can pick up from.

## Prerequisites

1. **Nowledge Mem desktop app** running (or the server accessible on port 14242)
2. **`nmem` CLI** on your PATH. In Nowledge Mem go to **Settings > Developer Tools > Install CLI**, use `pip install nmem-cli`, or on Arch Linux use `yay -S nmem-cli` / `paru -S nmem-cli`
3. **Amp** installed

```bash
nmem status     # Nowledge Mem is running
amp --version   # Amp is available
```

## Setup

From this plugin directory, run the install script:

```bash
bash scripts/install.sh
```

This copies the plugin into `${XDG_CONFIG_HOME:-~/.config}/amp/plugins/nowledge-mem/` and the skill into `${XDG_CONFIG_HOME:-~/.config}/amp/skills/nowledge-mem/`. If `XDG_CONFIG_HOME` is set, it overrides the default `~/.config` path. Restart Amp to load the plugin.

## Verify

Start a new Amp session and ask:

> What was I working on recently?

Amp should call `nowledge_mem_context_bundle` when full startup context matters, or `nowledge_mem_working_memory` as the lightweight fallback, then return your current context. If Mem is not running, you will see a connection error in the tool output.

## Update

Re-run `./scripts/install.sh` and restart Amp.

## Tools

| Tool | What it does |
|------|-------------|
| `nowledge_mem_context_bundle` | Read startup context: owner identity, AI Identity, active space, active rules, Working Memory, and KFS paths. |
| `nowledge_mem_working_memory` | Read today's Working Memory: focus areas, priorities, recent activity. |
| `nowledge_mem_search` | Search knowledge from all your tools. Supports label, limit, and deep mode filters. |
| `nowledge_mem_save` | Save a decision, insight, or preference so any tool can find it. |
| `nowledge_mem_update` | Update an existing memory with refined information. |
| `nowledge_mem_thread_search` | Search past conversations from any tool. |
| `nowledge_mem_save_thread` | Save the current session as a full conversation thread (SDK extraction + HTTP). |
| `nowledge_mem_save_handoff` | Save a curated handoff summary (lighter, agent-composed). |
| `nowledge_mem_graph_expand` | Expand the knowledge graph around a memory: neighbours and labelled edges. |
| `nowledge_mem_status` | Check Nowledge Mem server connectivity and diagnostics. |

## Commands

| Command | What it does |
|---------|-------------|
| `nowledge-mem:status` | Run a status check and show the result. |
| `nowledge-mem:save-thread` | Capture the current session as a thread. |
| `nowledge-mem:search` | Prompt for a query and run a memory search. |

## How session capture works

1. **Automatic live capture.** At the end of each agent turn (`agent.end`), the plugin reads the full transcript through Amp's thread API and creates or appends the matching `amp-<threadID>` thread in Nowledge Mem over HTTP. This works in local and remote mode because the plugin runs where Amp owns the session.

2. **Manual full session capture.** `nowledge_mem_save_thread` uses the same capture path on demand. It is idempotent (safe to call multiple times) and handles large sessions via HTTP, not shell arguments.

3. **Plugin proactive knowledge save.** `nowledge_mem_save` captures individual decisions and insights as they happen, stamped with `source=amp`. `nowledge_mem_save_handoff` creates a curated summary at wrap-up.

## Customize without editing the plugin

Amp gives you proper instruction surfaces. Use them instead of editing the installed plugin bundle.

- Shared repo rules: `AGENTS.md`
- Personal global rules: `~/.config/amp/AGENTS.md`
- The included `AGENTS.md` in this package is reference text only.

## Configuration

No config needed for local use.

| Env Variable | Default | What it does |
|-------------|---------|--------------|
| `NMEM_API_URL` | *(local)* | Remote Nowledge Mem server URL |
| `NMEM_API_KEY` | *(none)* | API key for remote access |
| `NMEM_SPACE` / `NMEM_SPACE_ID` | *(none)* | Ambient space for this session |
| `NMEM_AGENT_ID` | *(none)* | Stable Nowledge AI Identity for this run |
| `NMEM_AMP_AUTO_SYNC` | `1` | Set to `0`/`false`/`off`/`no` to disable automatic session capture |
| `NMEM_AMP_AUTO_SYNC_DEBOUNCE_MS` | `1500` | Debounce window for automatic capture |

The plugin also reads `~/.nowledge-mem/config.json` (shared with all Nowledge Mem integrations). Environment variables take priority.

### Remote access

```json title="~/.nowledge-mem/config.json"
{
  "apiUrl": "https://your-server",
  "apiKey": "your-key"
}
```

That shared config is used by both the `nmem` command paths and the HTTP session-save path. See [Access Mem Anywhere](https://mem.nowledge.co/docs/remote-access).

### Spaces

Spaces are optional. If one Amp process naturally belongs to one project or agent lane, set it once:

```json title="~/.nowledge-mem/config.json"
{
  "space": "Research Agent"
}
```

Or launch Amp with an explicit lane:

```bash
NMEM_SPACE="Research Agent" amp
```

For multi-agent setups, set `NMEM_AGENT_ID=<agent-slug>` per spawned Amp worker.

## Troubleshooting

- **nmem not found.** Install with `pip install nmem-cli`, or on Arch Linux `yay -S nmem-cli` / `paru -S nmem-cli`, then run `nmem status` to verify.
- **Server not responding.** Start the Nowledge Mem desktop app, or check `nmem status` for diagnostics.
- **Plugin not loading.** Re-run `./scripts/install.sh`, confirm the files exist under `~/.config/amp/plugins/nowledge-mem/`, and restart Amp.

## Links

- [Amp integration guide](https://mem.nowledge.co/docs/integrations/amp)
- [Documentation](https://mem.nowledge.co/docs/integrations)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
