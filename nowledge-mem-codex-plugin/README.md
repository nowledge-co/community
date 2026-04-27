# Nowledge Mem for Codex

> Your Codex agent can start from current context, retrieve past work proactively, and save what is worth keeping.

Switch between Claude Code, Gemini, Cursor, and Codex without losing context. Decisions you made last week, procedures you discovered yesterday, the architecture rationale from three months ago: it's all there when you need it.

## What you get

- **Pick up where you left off.** Every session can start from your current priorities, recent decisions, and unresolved questions.
- **Stronger retrieval on modern Codex.** The package bundles the local Nowledge Mem MCP server so Codex is more willing to search, inspect prior threads, and write memories proactively.
- **Insights stick around.** The package teaches Codex when to distill durable decisions and learnings, and MCP makes the memory-write path cheaper for the runtime to choose.
- **Real session history.** Save the full Codex transcript, not just a summary.
- **Quick diagnostics.** One command to verify everything is connected.

Codex does not give this package hard lifecycle hooks like Claude Code or OpenClaw. The reliable bootstrap is still Working Memory. On modern Codex, the best setup is:

- plugin package for Working Memory guidance, `nmem` fallback, status, and real `save-thread`
- bundled Nowledge Mem MCP for stronger retrieval and memory writes
- project `AGENTS.md` for repo-specific follow-through

## Skills

| Skill | When it runs | What it does |
|-------|-------------|-------------|
| `working-memory` | Session start, "what am I working on" | Loads your daily briefing and prefers MCP `read_working_memory` when present |
| `search-memory` | Prior work, past decisions | Searches memories and conversations, preferring MCP retrieval when present |
| `save-thread` | "Save this session" | Imports the real Codex transcript |
| `distill-memory` | Decisions, learnings emerge | Saves durable insights to memory, preferring MCP writes when present |
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

Add the Nowledge marketplace:

```bash
codex plugin marketplace add nowledge-co/community
```

If your Codex build still uses the legacy top-level subcommand:

```bash
codex marketplace add nowledge-co/community
```

Install `nowledge-mem@nowledge-community` from Codex `/plugins`.

Then put this in `~/.codex/config.toml` to enable the plugin:

```toml
[features]
plugins = true

[plugins."nowledge-mem@nowledge-community"]
enabled = true
```

Restart Codex after installation.

The package already includes a local Nowledge Mem MCP server at `http://127.0.0.1:14242/mcp/`. Codex uses your `~/.codex/config.toml` entry if you define `mcp_servers.nowledge-mem` yourself, so remote Mem and custom local ports stay explicit.

If you prefer to copy a bundled example, see [`codex.config.example.toml`](./codex.config.example.toml).

For remote Mem, keep the plugin block and override the bundled MCP server with your server:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
nmem config mcp show --host codex
```

Paste the generated TOML into `~/.codex/config.toml`. Direct MCP clients do not read `~/.nowledge-mem/config.json` by themselves; the generated block gives Codex the same URL and key that `nmem` already uses.

### Repo-level (this project only)

If you want a repo-pinned local package instead of the shared marketplace source, place the plugin in your repo and create a `marketplace.json`:

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

You still need the feature gate and plugin entry in `~/.codex/config.toml` (see Home-level above). For this local repo path, the plugin key is:

```toml
[plugins."nowledge-mem@local"]
enabled = true
```

Codex discovers repo-level marketplaces on startup and loads the plugin from that source.

## Verify

Start a new Codex session and ask: "What was I working on?" The agent should load your Working Memory briefing.

Then test one continuation-style prompt such as "What did we decide before about the OpenClaw release path?" or "Search prior work about this regression." On a healthy plugin + MCP setup, Codex should move beyond the briefing and call Nowledge Mem retrieval tools or the equivalent direct `nmem` search, not stop at the briefing alone.

If Mem is not running yet, try `$nowledge-mem:status` to check connectivity.

## Update

```bash
codex plugin marketplace update nowledge-community
```

If your Codex build does not support `plugin marketplace update`, run:

```bash
codex plugin marketplace upgrade nowledge-community
```

If neither update command exists, re-add the marketplace source:

```bash
codex marketplace add nowledge-co/community
```

Restart Codex after updating. If you are on a repo-local `@local` setup, update the local source path instead.

## Remote setup

If Nowledge Mem runs on another machine, save your credentials once:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
```

See [Remote Access](https://mem.nowledge.co/docs/remote-access) for details.

This shared local client config powers the package's direct `nmem` commands, including real `save-thread`. If you override the bundled MCP server in `~/.codex/config.toml`, point it to the same remote Mem server.

To generate the override block without hand-copying credentials:

```bash
nmem config mcp show --host codex
```

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

## Customize without editing the plugin

Treat your repo's `AGENTS.md` as the durable override layer for Codex.

- Do not edit the installed package files under the Codex plugin cache.
- Use the package `AGENTS.md` as reference text, then copy or merge only the parts you want into your repo's own `AGENTS.md`.
- Keep the plugin package for defaults and updates; keep your behavior tweaks in the repo you actually work in.

See [`../docs/USER_OVERRIDE_GUIDE.md`](../docs/USER_OVERRIDE_GUIDE.md) for the cross-host policy.

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
- **"Cannot connect to server"**: Run `nmem status`. For remote setups, check `~/.nowledge-mem/config.json`. See [Remote Access](https://mem.nowledge.co/docs/remote-access).
- **Skills not appearing**: Restart Codex after installing. Verify the marketplace was added, `nowledge-mem@nowledge-community` was installed from `/plugins`, and both `[features] plugins = true` and `[plugins."nowledge-mem@nowledge-community"] enabled = true` are in `~/.codex/config.toml`. If you intentionally use a repo-local marketplace source, use `[plugins."nowledge-mem@local"]`.
- **Only `codex marketplace` exists, not `codex plugin marketplace`**: use `codex marketplace add nowledge-co/community`. This is a host-version difference, not a plugin issue.
- **"plugin is not installed"**: Run `codex plugin marketplace add nowledge-co/community` (or `codex marketplace add nowledge-co/community` on legacy Codex), install `nowledge-mem@nowledge-community` from `/plugins`, then re-check your `~/.codex/config.toml` plugin key.
- **Only Working Memory runs, but search/distill never show up**: confirm the bundled MCP server is visible in Codex, then merge the package `AGENTS.md` into the project root for stronger repo-specific behavior. If Mem is remote or not on the default local port, add `mcp_servers.nowledge-mem` in `~/.codex/config.toml` to override the bundled local endpoint.

## Links

- [Codex integration guide](https://mem.nowledge.co/docs/integrations/codex-cli)
- [Documentation](https://mem.nowledge.co/docs)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)
