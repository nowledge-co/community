# Nowledge Mem -- Claude Code Plugin

> Your personal knowledge graph, built into Claude Code. Claude remembers your decisions, searches past work, and captures sessions -- without you asking.

## Install

```bash
# Add the Nowledge community marketplace
claude plugin marketplace add nowledge-co/community

# Install the plugin
claude plugin install nowledge-mem@nowledge-community
```

**Prerequisite:** `nmem` CLI must be in your PATH:

```bash
pip install nmem-cli    # or: pipx install nmem-cli
nmem status             # verify connection
```

On Windows/Linux with the Nowledge Mem desktop app, `nmem` is already bundled.

## What You Get

**Automatic (no action needed):**

- Working Memory briefing loaded at every session start, resume, and clear
- Per-turn behavioral nudge with search/save syntax
- Session conversations captured to your knowledge graph on each response
- Context recovered after compaction events

**Autonomous skills (Claude acts on its own):**

- **Search Memory** -- searches past work when you reference it
- **Distill Memory** -- suggests saving breakthroughs and decisions
- **Read Working Memory** -- loads your daily context briefing

**Slash commands (you trigger):**

| Command | What it does |
|---------|-------------|
| `/save` | Save this session to Nowledge Mem |
| `/search <query>` | Search your knowledge base |
| `/sum` | Distill insights from this conversation |
| `/status` | Check connection and server status |

## How It Works

### Lifecycle Hooks

| Event | Trigger | Action |
|-------|---------|--------|
| `SessionStart` | New, resume, or clear | Loads Working Memory via `nmem wm read` |
| `SessionStart` | After compaction | Re-loads Working Memory + checkpoint prompt |
| `UserPromptSubmit` | Every user message | Injects search/save syntax as context |
| `Stop` | Model finishes responding | Captures session to knowledge graph (async) |

The `SessionStart` hook tries `nmem wm read` first (works for both local and remote), then falls back to reading `~/ai-now/memory.md` directly.

The `Stop` hook runs `nmem t save --from claude-code` in the background after every response. This is idempotent -- it only appends new messages, so repeated runs are cheap and safe.

### Local vs Remote

The plugin works transparently in both modes:

- **Local** (Mem on same machine): Working Memory read from API or local file. Sessions captured by both the desktop app file watcher and the Stop hook (idempotent).
- **Remote** (Mem on different machine): Create `~/.nowledge-mem/config.json` with your connection settings. The `nmem` CLI reads this automatically.

```json
{
  "apiUrl": "https://your-server:14242",
  "apiKey": "your-key"
}
```

You can also use environment variables (`NMEM_API_URL`, `NMEM_API_KEY`), which override the config file.

## Update

```bash
claude plugin marketplace update
claude plugin update nowledge-mem@nowledge-community
# Restart Claude Code to apply changes
```

## Troubleshooting

**nmem not found:** Install with `pip install nmem-cli` or `pipx install nmem-cli`

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server

**Check status:** Run `/status` or `nmem status` to see connection details

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/claude-code)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
