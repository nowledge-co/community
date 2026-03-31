# Nowledge Mem for Codex

> Cross-AI memory plugin for Codex — search past decisions, distill insights, and recall context across all your AI tools.

A native Codex plugin that brings Nowledge Mem to your Codex agent through five composable skills backed by the `nmem` CLI.

## What You Get

- **Working Memory** — Start every session with context from your recent work across all connected AI tools
- **Proactive search** — The agent searches your knowledge base when past decisions or procedures are relevant
- **Autonomous distillation** — Key insights are saved as durable memories without you asking
- **Real session import** — Save the actual Codex transcript, not a summary
- **Server diagnostics** — Check connectivity and configuration with a single skill

## Skills

| Skill | Trigger | What it does |
|-------|---------|-------------|
| `read-working-memory` | Session start, "what am I working on" | Loads your daily Working Memory briefing |
| `search-memory` | Prior work, past decisions, "why did we..." | Searches memories and threads with progressive inspection |
| `save-thread` | "Save this session" | Real Codex transcript import via `nmem t save` |
| `distill-memory` | Decisions, learnings, procedures emerge | Proactively saves durable insights to memory |
| `status` | "Is Mem working?", errors | Checks server connectivity and configuration |

## Prerequisites

The `nmem` CLI must be available in your shell.

**If Nowledge Mem desktop app is installed:**
Settings > Preferences > Developer Tools > Install CLI

**Standalone install:**

```bash
# Install uv if you don't have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# Option 1: uvx (runs without install)
uvx --from nmem-cli nmem --version

# Option 2: pip (permanent install)
pip install nmem-cli
```

Verify: `nmem status`

See the [Getting Started guide](https://mem.nowledge.co/docs) for full setup instructions.

## Install

Copy the plugin directory into your Codex plugins path:

```bash
# Clone the community repo
git clone https://github.com/nowledge-co/community.git /tmp/nowledge-community

# Home-level install (available in all projects)
cp -r /tmp/nowledge-community/nowledge-mem-codex-plugin ~/.codex/plugins/nowledge-mem

# Or repo-level install (available in this project only)
cp -r /tmp/nowledge-community/nowledge-mem-codex-plugin ./.agents/plugins/nowledge-mem
```

Then enable it in `~/.codex/config.toml`:

```toml
[plugins."nowledge-mem@local"]
enabled = true
```

## Verify

Start a new Codex session and run `$nowledge-mem:status` to confirm the plugin loaded and Nowledge Mem is reachable.

## Update

Replace the plugin directory with the latest version:

```bash
cd /tmp && git clone https://github.com/nowledge-co/community.git nowledge-community-update
cp -r nowledge-community-update/nowledge-mem-codex-plugin ~/.codex/plugins/nowledge-mem
rm -rf nowledge-community-update
```

Then restart Codex.

## Remote setup

For remote Nowledge Mem, save your config to `~/.nowledge-mem/config.json`:

```json
{
  "apiUrl": "https://mem.example.com",
  "apiKey": "nmem_your_key"
}
```

`nmem` resolves connection settings in this order:

1. `--api-url` / `--api-key` flags
2. `NMEM_API_URL` / `NMEM_API_KEY` environment variables
3. `~/.nowledge-mem/config.json`
4. Defaults (localhost:14242)

See the [Remote Access guide](https://mem.nowledge.co/docs/remote-access) for details.

## Project guidance

Optionally copy `AGENTS.md` into your project root to reinforce memory behavior even outside plugin-aware contexts. If your project already has an `AGENTS.md`, merge the Nowledge section.

## Migrating from custom prompts

If you previously used `nowledge-mem-codex-prompts`:

1. Install this plugin (see above).
2. Remove the old prompts: `rm ~/.codex/prompts/{read_working_memory,search_memory,save_session,distill}.md`
3. The plugin skills replace the prompts one-to-one.

| Old prompt | New skill |
|-----------|-----------|
| `/prompts:read_working_memory` | `$nowledge-mem:read-working-memory` |
| `/prompts:search_memory` | `$nowledge-mem:search-memory` |
| `/prompts:save_session` | `$nowledge-mem:save-thread` |
| `/prompts:distill` | `$nowledge-mem:distill-memory` |
| *(none)* | `$nowledge-mem:status` |

## Troubleshooting

- **"Command not found: nmem"** — Install with `pip install nmem-cli` or use `uvx --from nmem-cli nmem`. See [Getting Started](https://mem.nowledge.co/docs).
- **"Cannot connect to server"** — Run `nmem status` and check `~/.nowledge-mem/config.json` for remote setups. See [Remote Access](https://mem.nowledge.co/docs/remote-access).
- **Skills not appearing** — Restart Codex after installing the plugin; verify the plugin is enabled in `~/.codex/config.toml`
- **Sessions not listing** — Make sure you save from the same project directory used in Codex

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Codex integration guide](https://mem.nowledge.co/docs/integrations/codex-cli)
- [Discord community](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)
