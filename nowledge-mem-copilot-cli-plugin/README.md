# Nowledge Mem — Copilot CLI Plugin

> Your personal knowledge graph, built into GitHub Copilot CLI. Copilot remembers your decisions, searches past work, and captures sessions — without you asking.

## Install

```bash
# Add the Nowledge community marketplace
copilot plugin marketplace add nowledge-co/community

# Install the plugin
copilot plugin install nowledge-mem@nowledge-community

# Set up session capture hooks
bash "$(copilot plugin path nowledge-mem@nowledge-community)/scripts/install-hooks.sh"
```

**Prerequisite:** `nmem` CLI must be in your PATH:

```bash
pip install nmem-cli    # or: pipx install nmem-cli
nmem status             # verify connection
```

On Windows/Linux with the Nowledge Mem desktop app, `nmem` is already bundled.

<a id="wsl-setup"></a>

**Using Copilot CLI inside WSL?** Paste this into your WSL terminal to bridge `nmem`:

```bash
mkdir -p ~/.local/bin && cat > ~/.local/bin/nmem << 'SHIMEOF'
#!/bin/bash
q=""; for a in "$@"; do q="$q \"$a\""; done
cmd.exe /s /c "\"nmem.cmd\"$q"
SHIMEOF
chmod +x ~/.local/bin/nmem
```

This calls the Windows `nmem` via interop — no extra setup or network configuration needed.

## What You Get

**Automatic (no action needed):**

- Working Memory briefing loaded at every session start, resume, and clear
- Per-turn behavioral nudge with memory search and save syntax
- Session conversations captured to your knowledge graph on each response
- Context recovered after compaction events

**Autonomous skills (Copilot acts on its own):**

- **Search Memory** — searches both distilled memories and prior sessions when continuity matters
- **Distill Memory** — suggests saving breakthroughs and decisions
- **Read Working Memory** — loads your daily context briefing

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

The `Stop` hook runs a Python capture script in the background after every response. It reads the Copilot CLI transcript, extracts messages, filters secrets, and creates threads via `nmem t import`. This is idempotent — repeated runs only append new content.

### Session Capture Details

The capture script (`copilot-stop-save.py`) handles:

- **Secret filtering** — redacts API keys, tokens, credentials (6 patterns + 10 skip patterns)
- **Incomplete turn detection** — skips when waiting for user input or background tasks
- **Concurrent safety** — file locking prevents race conditions with parallel sessions
- **Auto-distill** — valuable sessions are automatically distilled with guardrails (cooldown, content hash dedup, minimum thresholds)
- **Thread ID** — `copilot-{session_id}` (stable per-session, enables incremental append)

### Local vs Remote

The plugin works transparently in both modes:

- **Local** (Mem on same machine): Working Memory read from Mem, sessions captured locally.
- **Remote** (Mem on different machine): configure this machine once with:

```bash
nmem config client set url https://your-server:14242
nmem config client set api-key your-key
```

That writes the shared local client config used by `nmem` and the plugin. You can also use environment variables (`NMEM_API_URL`, `NMEM_API_KEY`) for temporary overrides.

## Spaces

Spaces are optional. If one Copilot CLI process naturally belongs to one project or agent lane, launch Copilot CLI with:

```bash
NMEM_SPACE="Research Agent"
```

The session-start Working Memory read, per-turn guidance, slash-command flows, and background capture will then stay in that lane automatically.

## Update

```bash
copilot plugin marketplace update nowledge-community
copilot plugin update nowledge-mem@nowledge-community

# Re-run install-hooks.sh to update the capture script
bash "$(copilot plugin path nowledge-mem@nowledge-community)/scripts/install-hooks.sh"

# Restart Copilot CLI to apply changes
```

## Troubleshooting

**nmem not found:** Install with `pip install nmem-cli` or `pipx install nmem-cli`. If you're in WSL, see the [WSL setup](#wsl-setup) above.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server

**Session capture not working:** Run `install-hooks.sh` again — it's idempotent. Check `~/.copilot/nowledge-mem-hooks/hook-log.jsonl` for diagnostics.

**Check status:** Run `/status` or `nmem status` to see connection details

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/copilot-cli)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
