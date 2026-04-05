# Nowledge Mem for Codex

> Your Codex agent remembers what you've worked on, across every AI tool you use.

Switch between Claude Code, Gemini, Cursor, and Codex without losing context. Decisions you made last week, procedures you discovered yesterday, the architecture rationale from three months ago: it's all there when you need it.

## What you get

- **Pick up where you left off.** Every session starts with what matters: your current priorities, recent decisions, and unresolved questions.
- **The agent searches for you.** When past context would improve the answer, the agent finds it without you asking.
- **Insights stick around.** Key decisions and learnings are saved automatically, ready for any future session in any tool.
- **Real session history.** Save the full Codex transcript, not just a summary.
- **Quick diagnostics.** One command to verify everything is connected.

## Skills

| Skill | When it runs | What it does |
|-------|-------------|-------------|
| `read-working-memory` | Session start, "what am I working on" | Loads your daily briefing |
| `search-memory` | Prior work, past decisions | Searches memories and conversations |
| `save-thread` | "Save this session" | Imports the real Codex transcript |
| `distill-memory` | Decisions, learnings emerge | Saves durable insights to memory |
| `status` | "Is Mem working?", errors | Checks connectivity |

## Prerequisites

`nmem` CLI must be in your PATH.

**Quickest path** (if the Nowledge Mem desktop app is running):
Settings > Preferences > Developer Tools > Install CLI

**Standalone:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version
```

Or `pip install nmem-cli`. Then verify with `nmem status`.

## Install

### Home-level (all projects)

```bash
git clone https://github.com/nowledge-co/community.git /tmp/nowledge-community
mkdir -p ~/.codex/plugins/cache/local/nowledge-mem/local
cp -r /tmp/nowledge-community/nowledge-mem-codex-plugin/* \
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

## Verify

Start a new Codex session and ask: "What was I working on?" The agent should load your Working Memory briefing. If Mem is not running yet, try `$nowledge-mem:status` to check connectivity.

## Update

```bash
git clone https://github.com/nowledge-co/community.git /tmp/nowledge-community-update
cp -r /tmp/nowledge-community-update/nowledge-mem-codex-plugin/* \
  ~/.codex/plugins/cache/local/nowledge-mem/local/
rm -rf /tmp/nowledge-community-update
```

Restart Codex after updating.

## Remote setup

If Nowledge Mem runs on another machine, save your credentials once:

```json title="~/.nowledge-mem/config.json"
{
  "apiUrl": "https://mem.example.com",
  "apiKey": "nmem_your_key"
}
```

See [Remote Access](https://mem.nowledge.co/docs/remote-access) for details.

## Project guidance

Copy `AGENTS.md` into your project root for stronger memory behavior in that repo. If you already have an `AGENTS.md`, merge the Nowledge section.

## Migrating from custom prompts

If you used `nowledge-mem-codex-prompts` before:

1. Install this plugin.
2. Remove old prompts: `rm ~/.codex/prompts/{read_working_memory,search_memory,save_session,distill}.md`

| Old prompt | New skill |
|-----------|-----------|
| `read_working_memory` | `$nowledge-mem:read-working-memory` |
| `search_memory` | `$nowledge-mem:search-memory` |
| `save_session` | `$nowledge-mem:save-thread` |
| `distill` | `$nowledge-mem:distill-memory` |
| *(none)* | `$nowledge-mem:status` |

## Troubleshooting

- **"Command not found: nmem"**: `pip install nmem-cli` or use `uvx --from nmem-cli nmem`. See [Getting Started](https://mem.nowledge.co/docs/installation).
- **"Cannot connect to server"**: Run `nmem status`. For remote setups, check `~/.nowledge-mem/config.json`. See [Remote Access](https://mem.nowledge.co/docs/remote-access).
- **Skills not appearing**: Restart Codex after installing. Verify both `[features] plugins = true` and `[plugins."nowledge-mem@local"] enabled = true` are in `~/.codex/config.toml`.
- **"plugin is not installed"**: Check that the plugin files are at `~/.codex/plugins/cache/local/nowledge-mem/local/` and that `.codex-plugin/plugin.json` exists inside that directory.

## Links

- [Codex integration guide](https://mem.nowledge.co/docs/integrations/codex-cli)
- [Documentation](https://mem.nowledge.co/docs)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)
