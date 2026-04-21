# Nowledge Mem for Pi

Cross-tool memory for Pi. Your decisions, preferences, and procedures persist across sessions and across every AI tool you use.

## What You Get

Pi gains five skills that connect it to your Nowledge Mem knowledge base:

| Skill | What it does |
|-------|-------------|
| `read-working-memory` | Loads your daily briefing at session start: focus areas, priorities, recent changes |
| `search-memory` | Searches past decisions, procedures, and preferences when context would help |
| `distill-memory` | Saves decisions, insights, and procedures as durable memories |
| `save-thread` | Creates a structured handoff summary of the session |
| `status` | Checks Nowledge Mem server connectivity |

## Prerequisites

1. **Nowledge Mem** desktop app running, or a remote server.
2. **`nmem` CLI** in your PATH:

```bash
pip install nmem-cli    # or: pipx install nmem-cli
nmem status             # verify connection
```

On Windows/Linux with the Nowledge Mem desktop app, `nmem` is already bundled.

## Install

**Via Pi package manager:**

```bash
pi install npm:nowledge-mem-pi
```

**Manual install:**

Copy the `skills/` directory into your Pi skills location:

```bash
# Global skills
cp -r skills/* ~/.pi/agent/skills/

# Or project-local skills
cp -r skills/* .pi/skills/
```

## Verify

Start a Pi session and check connectivity:

```
> check my Nowledge Mem status
```

Pi should run `nmem --json status` and report the server connection.

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

**nmem not found:** Install with `pip install nmem-cli` or `pipx install nmem-cli`.

**Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server.

**Remote setup:** Create `~/.nowledge-mem/config.json` with `{"apiUrl": "...", "apiKey": "..."}`, or set `NMEM_API_URL` and `NMEM_API_KEY` environment variables.

**Check status:** Ask Pi to run the `status` skill, or run `nmem status` directly.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/pi)
- [All Integrations](https://mem.nowledge.co/docs/integrations)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
