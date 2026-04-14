# Nowledge Mem for Codex

> Your Codex agent can start from current context, search prior work when it matters, and save what is worth keeping.

Switch between Claude Code, Gemini, Cursor, and Codex without losing context. Decisions you made last week, procedures you discovered yesterday, the architecture rationale from three months ago: it's all there when you need it.

## What you get

- **Pick up where you left off.** Every session can start from your current priorities, recent decisions, and unresolved questions.
- **Search when prior work matters.** The plugin teaches Codex when to search memories and threads, especially on continuation-style tasks.
- **Insights stick around.** The plugin teaches Codex to distill durable decisions and learnings when they emerge.
- **Automatic transcript capture is available.** Once you run the bundled host-level `Stop` hook installer, Codex can import the real transcript after each completed turn.
- **Real session history.** Save the full Codex transcript, not just a summary.
- **Quick diagnostics.** One command to verify everything is connected.

Codex does not give this package hard lifecycle hooks like Claude Code or OpenClaw. The reliable bootstrap is Working Memory. Search and distill are still skill-guided behaviors that Codex chooses when the task calls for them. For stronger repo-specific behavior, merge this package's `AGENTS.md` into your project root.

## Skills

| Skill | When it runs | What it does |
|-------|-------------|-------------|
| `working-memory` | Session start, "what am I working on" | Loads your daily briefing |
| `search-memory` | Prior work, past decisions | Searches memories and conversations |
| `save-thread` | "Save this session" | Imports the real Codex transcript |
| `distill-memory` | Decisions, learnings emerge | Saves durable insights to memory |
| `status` | "Is Mem working?", errors | Checks connectivity |

## Prerequisites

For day-to-day skill usage, put `nmem` on your PATH.

For automatic `Stop`-hook capture, the Python interpreter that runs `scripts/install_hooks.py` must be able to import `nmem_cli`. `uvx --from nmem-cli nmem` is enough for interactive CLI commands, but it does not make `nmem_cli` importable to Codex's hook runtime by itself.

**Quickest path** (if the Nowledge Mem desktop app is running):
Settings > Preferences > Developer Tools > Install CLI

**Standalone:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version
python3 -m pip install nmem-cli
python3 -c "import nmem_cli, nmem_cli.session_import"
```

Then verify with `nmem status`.

## Install

### Home-level (all projects)

```bash
git clone https://github.com/nowledge-co/community.git /tmp/nowledge-community
mkdir -p ~/.codex/plugins/cache/local/nowledge-mem/local
cp -R /tmp/nowledge-community/nowledge-mem-codex-plugin/. \
  ~/.codex/plugins/cache/local/nowledge-mem/local/
rm -rf /tmp/nowledge-community
```

Add both entries to `~/.codex/config.toml`:

```toml
[features]
plugins = true

[plugins."nowledge-mem@local"]
enabled = true
```

Install the bundled Codex hook helper with the same Python you want Codex to use for the hook runtime:

```bash
python3 ~/.codex/plugins/cache/local/nowledge-mem/local/scripts/install_hooks.py
```

Restart Codex after installation.

### Repo-level (this project only)

Place the plugin source in your repo and create a `marketplace.json` so Codex discovers it:

```bash
git clone https://github.com/nowledge-co/community.git /tmp/nowledge-community
mkdir -p .agents
cp -r /tmp/nowledge-community/nowledge-mem-codex-plugin ./.agents/nowledge-mem
rm -rf /tmp/nowledge-community
mkdir -p .agents/plugins
```

Create `.agents/plugins/marketplace.json`:

```json
{
  "name": "local",
  "plugins": [
    {
      "name": "nowledge-mem",
      "source": {
        "source": "local",
        "path": "./.agents/nowledge-mem"
      },
      "policy": {
        "installation": "INSTALLED_BY_DEFAULT"
      }
    }
  ]
}
```

The path is relative to the repo root, not to the `marketplace.json` file.

You still need the feature gate and plugin entry in `~/.codex/config.toml` (see Home-level above). Codex will discover the marketplace on startup and load the plugin from the repo-local source.

If you want automatic thread capture in repo-level installs too, run:

```bash
python3 ./.agents/nowledge-mem/scripts/install_hooks.py
```

## Codex Hook Support

Codex hooks are currently **host-level**, not plugin-local. In practice that means Codex reads `~/.codex/hooks.json`, not hook assets tucked inside the plugin directory.

This package therefore ships a small helper installer:

```bash
python3 ~/.codex/plugins/cache/local/nowledge-mem/local/scripts/install_hooks.py
```

It does four things:

1. Copies the bundled runtime hook into `~/.codex/hooks/nowledge-mem-stop-save.py`
2. Merges a `Stop` hook entry into `~/.codex/hooks.json`
3. Ensures `codex_hooks = true` exists under `[features]` in `~/.codex/config.toml`
4. Pins the installed hook shebang to the current `sys.executable` so Codex runs the hook with the same Python interpreter you used for installation

The installed `Stop` hook reads Codex's `transcript_path`, parses the rollout directly with `nmem_cli.session_import.parse_codex_session_streaming`, and imports the current thread into Mem. It keeps lightweight state in `~/.codex/nowledge_mem_codex_hook_state.json` so repeated `Stop` events only re-import when the transcript actually changed.

## Verify

Start a new Codex session and ask: "What was I working on?" The agent should load your Working Memory briefing.

Then test one continuation-style prompt such as "What did we decide before about the OpenClaw release path?" or "Search prior work about this regression." On a healthy setup, Codex should use `search-memory` or direct `nmem` search, not stop at the briefing alone.

If Mem is not running yet, try `$nowledge-mem:status` to check connectivity.

For automatic capture, you can also run a tiny one-shot check:

```bash
codex exec -C . "Reply with exactly OK and nothing else."
tail -n 20 ~/.codex/log/nowledge-mem-stop-hook.log
```

You should see `start event=Stop`, `nmem_exit=0`, and a `created thread=...`, `appended thread=...`, or `skip: ...` outcome entry in the hook log.

## Update

```bash
git clone https://github.com/nowledge-co/community.git /tmp/nowledge-community-update
cp -R /tmp/nowledge-community-update/nowledge-mem-codex-plugin/. \
  ~/.codex/plugins/cache/local/nowledge-mem/local/
rm -rf /tmp/nowledge-community-update
python3 ~/.codex/plugins/cache/local/nowledge-mem/local/scripts/install_hooks.py
```

Restart Codex after updating.

## Remote setup

If Nowledge Mem runs on another machine, save your credentials once:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
```

See [Remote Access](https://mem.nowledge.co/docs/remote-access) for details.

## Spaces

Spaces are optional. If one Codex session naturally belongs to one project or agent lane, launch Codex with:

```bash
export NMEM_SPACE="Research Agent"
codex
```

The Working Memory bootstrap, search-memory skill, save-thread skill, distill-memory skill, and direct `nmem` fallbacks will then stay in that lane automatically.

Shared spaces, default retrieval, and agent guidance come from Mem's own space profile. Codex should choose the ambient lane, not redefine what the space means.

## Project guidance

Copy `AGENTS.md` into your project root for stronger memory behavior in that repo. If you already have an `AGENTS.md`, merge the Nowledge section.

## Migrating from custom prompts

If you used `nowledge-mem-codex-prompts` before:

1. Install this plugin.
2. Remove old prompts: `rm ~/.codex/prompts/{read_working_memory,search_memory,save_session,distill}.md`

| Old prompt | New skill |
|-----------|-----------|
| `read_working_memory` | `$nowledge-mem:working-memory` |
| `search_memory` | `$nowledge-mem:search-memory` |
| `save_session` | `$nowledge-mem:save-thread` |
| `distill` | `$nowledge-mem:distill-memory` |
| *(none)* | `$nowledge-mem:status` |

## Troubleshooting

- **"Command not found: nmem"**: `pip install nmem-cli` or use `uvx --from nmem-cli nmem`. See [Getting Started](https://mem.nowledge.co/docs/installation).
- **"Cannot connect to server"**: Run `nmem status`. For remote setups, check `nmem config client show`. See [Remote Access](https://mem.nowledge.co/docs/remote-access).
- **Skills not appearing**: Restart Codex after installing. Verify both `[features] plugins = true` and `[plugins."nowledge-mem@local"] enabled = true` are in `~/.codex/config.toml`.
- **"plugin is not installed"**: Check that the plugin files are at `~/.codex/plugins/cache/local/nowledge-mem/local/` and that `.codex-plugin/plugin.json` exists inside that directory.
- **Hooks do not fire**: Run `python3 ~/.codex/plugins/cache/local/nowledge-mem/local/scripts/install_hooks.py` again, then confirm `~/.codex/hooks.json` exists and `codex_hooks = true` is present under `[features]` in `~/.codex/config.toml`.
- **Installer says `nmem_cli` is missing**: Run `python3 -m pip install nmem-cli`, then verify `python3 -c "import nmem_cli, nmem_cli.session_import"` succeeds before rerunning `scripts/install_hooks.py`.
- **No auto-save after a response**: Inspect `~/.codex/log/nowledge-mem-stop-hook.log`. The hook imports directly from Codex's `transcript_path`; if the log shows repeated skips, check that the installed hook starts with the same `#!python` you used for `scripts/install_hooks.py`, and that `python3 -c "import nmem_cli, nmem_cli.session_import"` succeeds in that interpreter.
- **Only Working Memory runs, but search/distill never show up**: this package is skill-guided, not hook-driven. Merge the package `AGENTS.md` into the project root for stronger repo-specific behavior, and verify you are asking a continuation-style question rather than a fresh isolated one.

## Links

- [Codex integration guide](https://mem.nowledge.co/docs/integrations/codex-cli)
- [Documentation](https://mem.nowledge.co/docs)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)
