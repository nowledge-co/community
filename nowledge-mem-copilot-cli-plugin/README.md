# Nowledge Mem — Copilot CLI Plugin

> Your personal knowledge graph, built into GitHub Copilot CLI. Copilot loads your Working Memory, nudges for recall, and captures sessions automatically.

## Install

First inspect the marketplace:

```bash
copilot plugin marketplace list
```

Inspect every entry, including aliases and pinned or local sources. Stop if the community repository appears under another name, or an entry has unclear provenance that prevents ruling out a related source. Only when both `nowledge-community` and related sources are unambiguously absent, run `copilot plugin marketplace add nowledge-co/community`, then list again. Continue only when its source is exactly `GitHub: nowledge-co/community`, without a branch, tag or commit pin. Reuse an existing verified registration. Stop if the source conflicts, multiple entries match, or the listing cannot establish its identity.

Then install the source-qualified plugin:

```bash
copilot plugin install nowledge-mem@nowledge-community
```

**Prerequisite:** `nmem` CLI must be in your PATH:

```bash
pip install nmem-cli    # or: pipx install nmem-cli
# Arch Linux: yay -S nmem-cli  # or: paru -S nmem-cli
nmem status             # verify connection
```

On Windows/Linux with the Nowledge Mem desktop app, `nmem` is already bundled.

<a id="wsl-setup"></a>

**Using Copilot CLI inside WSL?** Paste this into your WSL terminal to bridge `nmem`:

```bash
mkdir -p ~/.local/bin && cat > ~/.local/bin/nmem << 'SHIMEOF'
#!/bin/bash
python3 - "$@" <<'PY'
import subprocess
import sys

cmd = subprocess.list2cmdline(["nmem.cmd", *sys.argv[1:]])
raise SystemExit(subprocess.run(["cmd.exe", "/s", "/c", cmd]).returncode)
PY
SHIMEOF
chmod +x ~/.local/bin/nmem
```

This calls the Windows `nmem` via interop — no extra setup or network configuration needed.

## What You Get

**Automatic (no action needed):**

- Working Memory briefing loaded at every session start, resume, and clear
- Per-turn behavioral nudge with memory search and save syntax
- Session conversations captured to your knowledge graph on each response
- Current transcript captured before compaction, then Working Memory recovered after compaction events

**Skills (model-mediated; Copilot may expose them as namespaced entries):**

- **Read Working Memory** — loads Context Bundle when available, or your daily context briefing as the lightweight fallback
- **Search Memory** — searches both distilled memories and prior sessions when continuity matters
- **Distill Memory** — suggests saving breakthroughs and decisions
- **Save Thread** — saves a concise summary thread when the user explicitly asks to save/checkpoint the session

The plugin no longer ships separate command docs. Skills are still interpreted by the model and then invoke `nmem` as needed; they are not host-native direct shell commands. For direct terminal checks outside the skill surface, run the `nmem` CLI yourself (for example `nmem status`).

## How It Works

### Lifecycle Hooks

| Event | Trigger | Action |
|-------|---------|--------|
| `SessionStart` | New, resume, or clear | Loads Context Bundle via `nmem --json context --source-app copilot-cli`, then falls back to Working Memory |
| `SessionStart` | After compaction | Re-loads Context Bundle or Working Memory + checkpoint prompt |
| `UserPromptSubmit` | Every user message | Injects search/save syntax as context |
| `Stop` | Model finishes responding | Captures session to knowledge graph (async) |
| `PreCompact` | Before context compaction | Captures the current transcript before context is compressed |
| `SessionEnd` | Session exits or clears | Runs the same idempotent capture path as a final backstop |

The `SessionStart` hook tries `nmem --json context --source-app copilot-cli` first so Copilot receives identity, active scope, active rules, and current priorities when the installed CLI supports it. It falls back to `nmem --json wm read`, then to `~/ai-now/memory.md` only as the **Default-space** compatibility path.

The `Stop`, `PreCompact`, and `SessionEnd` hooks run the same Python capture script from the plugin's own `hooks/` directory. For older installs, it falls back to `nowledge-mem-hooks/` inside the active Copilot profile if that compatibility copy exists. It reads the Copilot CLI transcript, extracts messages, filters secrets, and creates threads via `nmem t import`. This is idempotent — repeated runs only append new content.

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
nmem config client set url https://your-server
nmem config client set api-key your-key
```

That writes the shared local client config used by `nmem` and the plugin. You can also use environment variables (`NMEM_API_URL`, `NMEM_API_KEY`) for temporary overrides.

## Spaces

Spaces are optional. If one Copilot CLI process naturally belongs to one project or agent lane, launch Copilot CLI with:

```bash
NMEM_SPACE="Research Agent"
```

The session-start Context Bundle / Working Memory read, per-turn guidance, skills, and background capture will then stay in that lane automatically.

For multi-agent orchestrators, set `NMEM_AGENT_ID=<agent-slug>` per spawned Copilot CLI worker. Add `NMEM_SPACE` only when that run should override the AI Identity's default space. `NMEM_HOST_AGENT_ID` is for advanced external aliases. Context Bundle will use the stable identity while keeping `source_app=copilot-cli` for provenance.

## Update

Before updating, run `copilot plugin marketplace list` and `copilot plugin list --json`. Use the commands below only when the complete marketplace listing confirms the unpinned `GitHub: nowledge-co/community` source without a related alias, and the plugin row reports `name: nowledge-mem`, `marketplace: nowledge-community`, and `source: installed`. Stop on conflicting or unclear results. For a direct or custom-source installation, use that source’s update flow.

```bash
copilot plugin marketplace update nowledge-community
copilot plugin update nowledge-mem@nowledge-community
```

Restart Copilot CLI to apply changes.

## Customize without editing the plugin

Copilot CLI already has a native instruction layer. Use that as your override path.

- Shared repo rules: `.github/copilot-instructions.md` or `.github/instructions/*.instructions.md`
- Personal rules across repos: `~/.copilot/copilot-instructions.md`
- Do not edit installed plugin hooks or scripts under `~/.copilot/installed-plugins/...`

Keep the plugin for lifecycle hooks and capture. Put your custom memory behavior in Copilot instruction files so updates do not wipe it out.

## Beyond the default tools

Use the MCP tools for the day-to-day per-turn loop. For anything beyond
that -- including graph and relationship queries -- reach for the `nmem`
CLI directly (already installed alongside this plugin). We recommend it
whenever you hit a gap in the per-turn tool set:

```bash
nmem graph expand <memory-or-crystal-id> --depth 2
nmem graph evolves <memory-id>
```

Run `nmem --help` (and `nmem graph --help`, `nmem <command> --help`, etc.)
to see its full capabilities.

## Troubleshooting

**nmem not found:** Install with `pip install nmem-cli` or `pipx install nmem-cli`. If you're in WSL, see the [WSL setup](#wsl-setup) above.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server

**Session capture not working:** Restart Copilot CLI first. If capture still does not run, check `nowledge-mem-hooks/hook-log.jsonl` inside the active Copilot profile. For older installs or local development, run `python3 scripts/install_hooks.py` (or `scripts/install-hooks.sh`) from the source checkout to install the complete compatibility runtime. An interrupted installation is recovered on the next run. If recovery reports an error, keep the transaction files and retry after resolving the reported filesystem problem.

The profile defaults to `~/.copilot`. Set `COPILOT_HOME` for a separate profile; the capture state, logs, and compatibility scripts all use that directory directly. A relative override is anchored to the process's starting directory. Paths are literal: `~`, `$HOME`, and shell expressions inside the value are not expanded. An explicitly empty value is rejected. Use the same profile for installation and Copilot sessions. Python 3 and `nmem` must be available for capture.

**Check status:** Run `nmem status` to see connection details

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/copilot-cli)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
