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

<a id="wsl-setup"></a>

**Using Claude Code inside WSL?** Paste this into your WSL terminal to bridge `nmem`:

```bash
mkdir -p ~/.local/bin && cat > ~/.local/bin/nmem << 'SHIMEOF'
#!/bin/bash
q=""; for a in "$@"; do q="$q \"$a\""; done
cmd.exe /s /c "\"nmem.cmd\"$q"
SHIMEOF
chmod +x ~/.local/bin/nmem
```

This calls the Windows `nmem` via interop — no extra setup or network configuration needed. Session capture works automatically through the desktop app's file watcher.

## What You Get

**Automatic (no action needed):**

- Working Memory briefing loaded at every session start, resume, and clear
- Per-turn behavioral nudge with memory search, thread search, and save syntax
- Session conversations captured to your knowledge graph on each response
- Context recovered after compaction events

**Autonomous skills (Claude acts on its own):**

- **Search Memory** -- searches both distilled memories and prior sessions when continuity matters
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

The `SessionStart` hook tries `nmem wm read` first (works for both local and remote), then falls back to reading `~/ai-now/memory.md` only as the **Default-space** compatibility path.

The `Stop` hook runs `nmem t save --from claude-code` in the background after every response. This is idempotent -- it only appends new messages, so repeated runs are cheap and safe.

### Local vs Remote

The plugin works transparently in both modes:

- **Local** (Mem on same machine): Working Memory read from Mem, with the local file kept only as the Default-space fallback. Sessions are captured by both the desktop app file watcher and the Stop hook (idempotent).
- **Remote** (Mem on different machine): configure this machine once with:

```bash
nmem config client set url https://your-server:14242
nmem config client set api-key your-key
```

That writes the shared local client config used by `nmem` and the plugin. You can also use environment variables (`NMEM_API_URL`, `NMEM_API_KEY`) for temporary overrides.

In remote mode, the Stop hook still reads Claude session files locally through `nmem t save --from claude-code` on the machine where Claude Code is running, then uploads the normalized messages to Mem. The remote Mem server does not need direct access to your `~/.claude` directory.

## Update

```bash
claude plugin marketplace update
claude plugin update nowledge-mem@nowledge-community
# Restart Claude Code to apply changes
```

## Troubleshooting

**nmem not found:** Install with `pip install nmem-cli` or `pipx install nmem-cli`. If you're in WSL, see the [WSL setup](#wsl-setup) above.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server

**Check status:** Run `/status` or `nmem status` to see connection details

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/claude-code)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
