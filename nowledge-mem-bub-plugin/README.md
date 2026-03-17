# Nowledge Mem — Bub Plugin

> Bring your cross-tool knowledge into Bub, and share what you learn in Bub with every other tool.

Bub records every session through its tape system. This plugin connects Bub to your personal knowledge graph in Nowledge Mem — so decisions from Claude Code, preferences from Cursor, and insights from ChatGPT are all searchable inside Bub. And what you learn in Bub flows back to every other tool.

## Install

```bash
pip install nowledge-mem-bub
```

**Prerequisite:** `nmem` CLI must be in your PATH:

```bash
pip install nmem-cli    # or: pipx install nmem-cli
nmem status             # verify connection
```

## Verify

```bash
uv run bub hooks        # should list nowledge_mem for system_prompt, build_prompt, save_state
uv run bub run "what was I working on this week?"
```

If you have existing knowledge in Nowledge Mem, the agent should find it through `mem.search`.

## Tools

| Tool | What it does |
|------|-------------|
| `mem.search` | Search knowledge from all your tools. Supports label and date filters. |
| `mem.save` | Save a decision, insight, or preference so any tool can find it. |
| `mem.context` | Read today's Working Memory — focus areas, priorities, recent activity. |
| `mem.connections` | Explore how a piece of knowledge relates to others across tools and time. |
| `mem.timeline` | Recent activity grouped by day. |
| `mem.forget` | Delete a memory by ID. |
| `mem.threads` | Search past conversations from any tool. |
| `mem.thread` | Fetch full messages from a conversation with pagination. |
| `mem.status` | Connection and configuration diagnostics. |

All tools work as Bub comma commands too: `,mem.search query=...`

**Bundled skill:** The `nowledge-mem` skill teaches the agent when and how to use these tools effectively.

## Configuration

No config needed for local use. The plugin reads `~/.nowledge-mem/config.json` and environment variables automatically.

| Variable | Default | What it does |
|----------|---------|-------------|
| `NMEM_SESSION_CONTEXT` | `false` | Inject Working Memory + recalled knowledge each turn |
| `NMEM_SESSION_DIGEST` | `true` | Feed Bub conversations into Mem for other tools to find |
| `NMEM_API_URL` | *(local)* | Remote Nowledge Mem server URL |
| `NMEM_API_KEY` | *(none)* | API key for remote access |

### Remote Access

```json
// ~/.nowledge-mem/config.json
{
  "apiUrl": "https://your-server:14242",
  "apiKey": "your-key"
}
```

Or use environment variables (`NMEM_API_URL`, `NMEM_API_KEY`), which override the config file.

## Two Modes

| Mode | Config | What happens |
|------|--------|-------------|
| **Default** | nothing | The agent searches and saves on demand. Conversations flow into Mem for other tools to find. |
| **Session context** | `NMEM_SESSION_CONTEXT=1` | Working Memory and relevant knowledge injected automatically each turn. |

Most users should start with the default.

## Troubleshooting

**nmem not found:** Install with `pip install nmem-cli` or `pipx install nmem-cli`.

**Plugin not loading:** Run `uv run bub hooks` and check that `nowledge_mem` appears in the hook list.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem status` for diagnostics.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/bub)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community/tree/main/nowledge-mem-bub-plugin)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
