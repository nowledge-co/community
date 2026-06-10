# Nowledge Mem for Pi

Cross-tool memory for Pi. Your decisions, preferences, and procedures persist across sessions and across every AI tool you use.

## What You Get

Pi gains a native extension plus five skills:

- Completed Pi conversations sync into Nowledge Mem as searchable threads
- Context Bundle / Working Memory, search, and distillation stay available through skills
- Remote Mem works through `~/.nowledge-mem/config.json` or `NMEM_API_URL` / `NMEM_API_KEY`

| Skill | What it does |
|-------|-------------|
| `read-working-memory` | Loads your daily briefing at session start: focus areas, priorities, recent changes |
| `search-memory` | Searches past decisions, procedures, and preferences when context would help |
| `distill-memory` | Saves decisions, insights, and procedures as durable memories |
| `save-thread` | Creates a curated handoff summary when you explicitly want one |
| `status` | Checks Nowledge Mem server connectivity |

## Prerequisites

1. **Nowledge Mem** desktop app running, or a remote server.
2. **`nmem` CLI** in your PATH:

```bash
pip install nmem-cli    # or: pipx install nmem-cli
# Arch Linux: yay -S nmem-cli  # or: paru -S nmem-cli
nmem status             # verify connection
```

On Windows/Linux with the Nowledge Mem desktop app, `nmem` is already bundled.

## Install

**Via Pi package manager:**

```bash
pi install npm:nowledge-mem-pi
```

**Manual install:**

Copy the `skills/` directory and extension into your Pi config:

```bash
# Global skills
cp -r skills/* ~/.pi/agent/skills/
mkdir -p ~/.pi/agent/extensions
cp extensions/nowledge-mem.ts ~/.pi/agent/extensions/

# Or project-local skills
cp -r skills/* .pi/skills/
mkdir -p .pi/extensions
cp extensions/nowledge-mem.ts .pi/extensions/
```

## Verify

Start a Pi session and check connectivity:

```
> check my Nowledge Mem status
```

Pi should run `nmem --json status` and report the server connection.

Then have a short Pi exchange and check recent threads:

```bash
nmem t list --source pi -n 5
```

## Update

```bash
pi update
```

## Project Guidance

For behavioral guidance that shapes how Pi uses these skills (when to search, when to save, retrieval routing), see [AGENTS.md](AGENTS.md). Place it alongside your project configuration so Pi follows it automatically.

## Customize without editing the package

Use your project's own `AGENTS.md` as the override layer for Pi.

- Keep the package skills as shipped defaults
- Copy or merge the package `AGENTS.md` into your project config area
- Do not patch installed package files under the Pi package cache

That keeps your custom behavior durable across package updates.

## Troubleshooting

**nmem not found:** Install with `pip install nmem-cli`, `pipx install nmem-cli`, or on Arch Linux `yay -S nmem-cli` / `paru -S nmem-cli`.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server.

**Remote setup:** Create `~/.nowledge-mem/config.json` with `{"apiUrl": "...", "apiKey": "..."}`, or set `NMEM_API_URL` and `NMEM_API_KEY` environment variables. The extension uses the same config for automatic thread sync.

**Check status:** Ask Pi to run the `status` skill, or run `nmem status` directly.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/pi)
- [All Connectors](https://mem.nowledge.co/docs/integrations)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
