# Nowledge Mem for Droid

> Your personal knowledge graph inside Factory Droid. Read Working Memory at session start, recall past decisions when they matter, distill durable knowledge, and save honest resumable handoffs when you ask.

This package is the Droid-native Nowledge Mem surface.

It uses the host's plugin model directly:

- lifecycle hooks for Working Memory bootstrap and lightweight behavioral guidance
- agent skills for routed recall, distillation, and handoff judgment
- slash commands for explicit memory workflows
- `nmem` CLI as the execution layer for local and remote Mem access

The Factory marketplace manifest stays close to Factory's documented schema. Droid discovers the plugin from the repository-level marketplace, then loads commands, skills, and hooks from this package root.

This package intentionally does **not** expose `save-thread`.

Droid does not yet have a Nowledge transcript importer wired into `nmem t save --from ...`, so summary-only behavior must stay named `save-handoff`.

## Install

```bash
# Add the Nowledge community marketplace
droid plugin marketplace add https://github.com/nowledge-co/community

# Install the plugin
droid plugin install nowledge-mem@nowledge-community
```

For local development from a checkout:

```bash
git clone https://github.com/nowledge-co/community.git
cd community
droid plugin marketplace add .
droid plugin install nowledge-mem@nowledge-community
```

## Requirements

- [Factory Droid](https://www.factory.ai/)
- [Nowledge Mem](https://mem.nowledge.co) running locally, or a reachable remote Mem server
- `nmem` CLI in your `PATH`

If Nowledge Mem is already running on the same machine through the desktop app, the cleanest setup is to install the bundled CLI from **Settings -> Preferences -> Developer Tools -> Install CLI**.

You can also install `nmem` standalone:

```bash
# Option 1: pip
pip install nmem-cli

# Option 2: uvx
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version
```

Verify the connection:

```bash
nmem status
```

## What You Get

**Automatic lifecycle behavior**

- Working Memory loads at session start, resume, clear, and after compaction
- Per-turn guidance nudges Droid to search before answering and distill valuable outcomes

**Slash commands**

- `/nowledge-read-working-memory`
- `/nowledge-search-memory`
- `/nowledge-distill-memory`
- `/nowledge-save-handoff`
- `/nowledge-status`

**Agent skills**

- `read-working-memory`
- `search-memory`
- `distill-memory`
- `save-handoff`

## Handoff Vs Thread Save

This distinction is intentional and strict:

- `save-handoff` creates a compact resumable summary through `nmem --json t create`
- `save-thread` would mean importing the real recorded Droid session messages

That second path does not exist yet for Droid, so this plugin does not claim it.

If Droid later gains a real transcript-backed importer, the package can add a true `save-thread` surface then.

## Local Vs Remote

By default, `nmem` connects to the local Mem server at `http://127.0.0.1:14242`.

For remote Mem, prefer:

```json
{
  "apiUrl": "https://mem.example.com",
  "apiKey": "nmem_your_key"
}
```

Save that to:

```text
~/.nowledge-mem/config.json
```

`nmem` loads connection settings with this priority:

- `--api-url` flag
- `NMEM_API_URL` / `NMEM_API_KEY`
- `~/.nowledge-mem/config.json`
- defaults

For temporary overrides, launch Droid from a shell where the environment variables are already exported.

### Spaces

Spaces are optional. If one Droid runtime naturally belongs to one project or agent lane, launch Droid with:

```bash
NMEM_SPACE="Research Agent"
```

The bundled `nmem`-backed Working Memory, search, save, and handoff flows will then stay in that lane automatically.

## Direct `nmem` Use Is Always Allowed

The plugin commands and skills are convenience surfaces, not a cage. Droid can still compose direct `nmem` commands when that is clearer.

Examples:

```bash
nmem wm read
nmem --json m search "auth token rotation" --mode deep
nmem --json t search "previous migration discussion" --limit 5
nmem --json t create -t "Session Handoff - auth refactor" -c "Goal: finish the auth refactor. Decisions: keep refresh verification in the API layer. Files: api/auth.ts, auth.test.ts. Risks: remote expiry behavior still needs validation. Next: verify remote session expiry end to end." -s droid
nmem status
```

## Update

```bash
droid plugin marketplace update nowledge-community
droid plugin update nowledge-mem@nowledge-community
```

## Validate Locally

From the `community/` checkout root:

```bash
node nowledge-mem-droid-plugin/scripts/validate-plugin.mjs
```

Or from inside `community/nowledge-mem-droid-plugin/`:

```bash
node scripts/validate-plugin.mjs
```

This validates the plugin manifest, required files, honest handoff semantics, and the repository-level Factory marketplace entry.

## Troubleshooting

**`nmem` not found:** Install with `pip install nmem-cli` or `uvx --from nmem-cli nmem --version`.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server.

**Remote auth issues:** Check `~/.nowledge-mem/config.json`, then run `nmem status`.

**No `save-thread` command:** That is intentional. This package only exposes `save-handoff` until Droid has a real transcript-backed importer.

## Links

- [Factory plugins documentation](https://docs.factory.ai/cli/configuration/plugins)
- [Building plugins for Factory Droid](https://docs.factory.ai/guides/building/building-plugins)
- [Nowledge Mem](https://mem.nowledge.co)
- [Community repository](https://github.com/nowledge-co/community)
