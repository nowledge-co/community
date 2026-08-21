# Nowledge Mem -- Claude Code / Grok Build Plugin

> Your personal knowledge graph, built into Claude Code and Grok Build. Your agent remembers decisions, searches past work, and captures sessions -- without you asking.

## Install

Claude Code:

```bash
# Add the Nowledge community marketplace
claude plugin marketplace add https://github.com/nowledge-co/community

# Install the plugin
claude plugin install nowledge-mem@nowledge-community
```

Grok Build:

```bash
grok plugin install nowledge-co/community#nowledge-mem-claude-code-plugin --trust
```

Restart Grok Build, then run `grok plugin details nowledge-mem` and open
`/hooks` to verify that the plugin is enabled, trusted, and its lifecycle
hooks are registered. Grok can load skills from an enabled plugin while
still blocking hooks from an untrusted plugin, so skill visibility alone is
not a capture check.

**Prerequisite:** `nmem` CLI must be in your PATH. Hook capture also needs `python3` or `python` available on the same machine:

```bash
pip install nmem-cli    # or: pipx install nmem-cli
# Arch Linux: yay -S nmem-cli  # or: paru -S nmem-cli
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

**Claude Code lifecycle hooks:**

- Context Bundle loaded at every session start, resume, and clear when available, with Working Memory fallback
- Bounded Context Bundle injected for selected Claude Code subagent types, with routing-only or no-op behavior for simpler agents
- Per-turn behavioral nudge with memory search, thread search, and save syntax
- Per-turn managed-skills nudge for recurring procedural work (`find_skills` / `nmem skills match`)

**Grok Build lifecycle hooks:**

- Stop, PreCompact, SubagentStop, and SessionEnd capture the exact Grok Build session through `nmem`
- Passive Grok hooks do not inject stdout into model context; the `read-working-memory` skill loads Context Bundle on the first relevant turn

**Both hosts:**

- Session conversations captured to your knowledge graph on each response
- Session conversations captured again before context compaction
- Context recovered after compaction events in Claude Code; Grok Build can re-run `read-working-memory` after compaction when continuity is needed

**Autonomous skills (the host invokes when relevant):**

- **Search Memory** -- searches both distilled memories and prior sessions when continuity matters
- **Distill Memory** -- suggests saving breakthroughs and decisions
- **Read Working Memory** -- loads Context Bundle when available, or the lighter daily briefing fallback

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
| `SessionStart` | New, resume, or clear | Claude Code loads Context Bundle via `nmem context`, then falls back to `nmem wm read` |
| `SessionStart` | After compaction | Claude Code re-loads Context Bundle or Working Memory + checkpoint prompt |
| `SubagentStart` | Claude Code spawns a subagent | Selects full context, routing-only, or no-op behavior from `agent_type` |
| `UserPromptSubmit` | Every user message | Claude Code injects search/save syntax as context |
| `PreCompact` | Before manual or automatic compaction | Saves the exact Claude Code or Grok Build session by hook `session_id` before context is compressed |
| `Stop` | Model finishes responding | Captures session to knowledge graph |
| `SubagentStop` | Grok Build subagent finishes | Captures the subagent session without blocking the subagent gate |
| `SessionEnd` | Grok Build process exits | Performs a final best-effort session capture after the last turn |

In Claude Code, the `SessionStart` hook tries `nmem context` first so the model receives owner identity, AI Identity, active space, active rules, Working Memory, and KFS paths when the installed CLI supports it. It falls back to `nmem wm read`, then to `~/ai-now/memory.md` only as the **Default-space** compatibility path.

The Claude Code `SubagentStart` hook reuses the same source but caps the complete bootstrap envelope at 4 KiB. Full Context Bundle injection uses the exact, case-sensitive `NMEM_SUBAGENT_CONTEXT_TYPES` allowlist, which defaults to `Plan,code-reviewer,architect,researcher`. `Explore` receives no Mem prompt by default; other unlisted types receive retrieval routing without loading the Context Bundle. Setting the variable replaces the default allowlist, and an empty value disables full Context Bundle injection for every type.

Grok Build treats `SessionStart`, `UserPromptSubmit`, and `SubagentStart` as
passive hooks and discards their stdout. The plugin therefore does not spend
an API call producing context that Grok cannot deliver. Grok exposes the same
Context Bundle flow through the model-invoked `read-working-memory` skill;
run `/read-working-memory` explicitly when you want to force a refresh.

The `PreCompact` hook runs the same client-side thread save before the host compresses context. The `Stop`, `SubagentStop`, and `SessionEnd` hooks run it again through a detached worker with a bounded retry window, so short transcript-flush delays or process exit do not turn into silent no-op saves. Claude Code uses `nmem t save --from claude-code`; Grok Build uses `nmem t save --from grok`. Both paths pass the host session id into `nmem t save`, so concurrent sessions in the same project do not have to rely on "latest session" guessing.

If the desktop app's Claude Code file watcher is also enabled, you can leave it on. The watcher and plugin hooks converge on the same `claude-code-<sessionId>` thread, so repeated saves update the existing thread instead of creating a second one.

### Local vs Remote

The plugin works transparently in both modes:

- **Local** (Mem on same machine): Context Bundle or Working Memory read from Mem, with the local file kept only as the Default-space fallback. Sessions are captured by the desktop app file watcher, the Stop hook, and the PreCompact hook before context compression.
- **Remote** (Mem on different machine): configure this machine once with:

```bash
nmem config client set url https://your-server
nmem config client set api-key your-key
```

That writes the shared local client config used by `nmem` and the plugin. You can also use environment variables (`NMEM_API_URL`, `NMEM_API_KEY`) for temporary overrides.

In remote mode, the lifecycle hooks still read local host session files through `nmem t save --from claude-code` or `nmem t save --from grok` on the machine where the coding agent is running, then upload the normalized messages to Mem. The remote Mem server does not need direct access to your `~/.claude` or Grok session directory.

### Import older sessions

Automatic capture starts after the plugin and hooks are installed. To backfill older Claude Code sessions, preview first:

```bash
nmem t sync --from claude-code --all-projects --limit 20
# Grok Build:
nmem t sync --from grok --all-projects --limit 20
```

Then import:

```bash
nmem t sync --from claude-code --all-projects --apply
# Grok Build:
nmem t sync --from grok --all-projects --apply
```

Use `-p /path/to/project` instead of `--all-projects` when you only want one project. The command reads local Claude Code session files and writes to the Mem server configured in `nmem`.

## Spaces

Spaces are optional. If one Claude Code process naturally belongs to one project or agent lane, launch Claude Code with:

```bash
NMEM_SPACE="Research Agent"
```

The session-start Context Bundle / Working Memory read, per-turn guidance, slash-command flows, and hook-driven `nmem t save --from claude-code` capture will then stay in that lane automatically.

The plugin never invents a space from the current folder, git repository, branch, or project name. Without `NMEM_SPACE`, it reads and saves in your default Mem space. This keeps opening an unfamiliar repo from creating a new space in your graph.

For multi-agent orchestrators, set `NMEM_AGENT_ID=<agent-slug>` per spawned Claude Code worker. Add `NMEM_SPACE` only when that run should override the AI Identity's default space. `NMEM_HOST_AGENT_ID` is for advanced external aliases. Context Bundle will use the stable identity while keeping `source_app=claude-code` for provenance.

Shared spaces, default retrieval, and agent guidance still live in Mem's own space profile. Claude Code does not need a second plugin-local space config.

## Update

```bash
claude plugin marketplace update nowledge-community
claude plugin update nowledge-mem@nowledge-community
# Restart Claude Code to apply changes

# Grok Build
grok plugin update nowledge-mem
grok plugin details nowledge-mem
```

After a Grok Build or plugin update, restart Grok and re-check `/hooks`. A
completed turn should create or update a `grok-*` thread in Mem; plugin skills
being visible does not prove capture hooks are trusted and active.

## Customize without editing the plugin

Claude Code already has a clean override surface.

- Put shared repo rules in `CLAUDE.md`.
- Put your personal local tweaks in `CLAUDE.local.md`.
- Do not edit the installed Nowledge Mem plugin files under Claude's plugin directory.

Use `CLAUDE.local.md` for small personal memory-behavior changes such as "prefer saving Chinese notes" or "be more aggressive about searching prior release work" without forcing that rule on the whole team.

## Beyond the default tools

The `nmem` CLI (already installed alongside this plugin) can do a lot more
than the per-turn MCP tools cover -- including graph and relationship
queries. **We recommend reaching for `nmem` directly** whenever you need
something outside the per-turn tool set:

```bash
nmem graph expand <memory-or-crystal-id> --depth 2
nmem graph evolves <memory-id>
```

Run `nmem --help` (and `nmem graph --help`, `nmem <command> --help`, etc.)
to see its full capabilities.

## Troubleshooting

**nmem not found:** Install with `pip install nmem-cli` or `pipx install nmem-cli`. If you're in WSL, see the [WSL setup](#wsl-setup) above.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server

**Check status:** Run `/status` or `nmem status` to see connection details

**Grok skills load but sessions are not captured:** Run
`grok plugin details nowledge-mem`, then inspect `/hooks`. Reinstall with
`--trust` if the hooks are blocked, restart Grok Build, complete one turn, and
confirm a recent thread with `nmem t search "a phrase from that turn" --source grok`.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/claude-code)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
