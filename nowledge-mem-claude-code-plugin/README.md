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
- Session conversations captured again before context compaction
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
| `PreCompact` | Before manual or automatic compaction | Saves the exact Claude Code session by hook `session_id` before context is compressed |
| `Stop` | Model finishes responding | Captures session to knowledge graph (async) |

The `SessionStart` hook tries `nmem wm read` first (works for both local and remote), then falls back to reading `~/ai-now/memory.md` only as the **Default-space** compatibility path.

The `PreCompact` hook runs the same client-side thread save before Claude Code compresses the context. The `Stop` hook runs it again in the background after every response. Both paths pass Claude's hook `session_id` into `nmem t save`, so concurrent sessions in the same project do not have to rely on "latest session" guessing.

### Local vs Remote

The plugin works transparently in both modes:

- **Local** (Mem on same machine): Working Memory read from Mem, with the local file kept only as the Default-space fallback. Sessions are captured by the desktop app file watcher, the Stop hook, and the PreCompact hook before context compression.
- **Remote** (Mem on different machine): configure this machine once with:

```bash
nmem config client set url https://your-server:14242
nmem config client set api-key your-key
```

That writes the shared local client config used by `nmem` and the plugin. You can also use environment variables (`NMEM_API_URL`, `NMEM_API_KEY`) for temporary overrides.

In remote mode, the Stop and PreCompact hooks still read Claude session files locally through `nmem t save --from claude-code` on the machine where Claude Code is running, then upload the normalized messages to Mem. The remote Mem server does not need direct access to your `~/.claude` directory.

## Spaces

Spaces are optional. If one Claude Code process naturally belongs to one project or agent lane, launch Claude Code with:

```bash
NMEM_SPACE="Research Agent"
```

The session-start Working Memory read, per-turn guidance, slash-command flows, and background `nmem t save --from claude-code` capture will then stay in that lane automatically.

Shared spaces, default retrieval, and agent guidance still live in Mem's own space profile. Claude Code does not need a second plugin-local space config.

## Update

```bash
claude plugin marketplace update
claude plugin update nowledge-mem@nowledge-community
# Restart Claude Code to apply changes
```

## Customize without editing the plugin

Claude Code already has a clean override surface.

- Put shared repo rules in `CLAUDE.md`.
- Put your personal local tweaks in `CLAUDE.local.md`.
- Do not edit the installed Nowledge Mem plugin files under Claude's plugin directory.

Use `CLAUDE.local.md` for small personal memory-behavior changes such as "prefer saving Chinese notes" or "be more aggressive about searching prior release work" without forcing that rule on the whole team.

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
