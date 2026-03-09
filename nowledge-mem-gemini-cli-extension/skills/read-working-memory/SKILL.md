---
name: read-working-memory
description: Read the user's daily Working Memory briefing at session start or when recent priorities matter. This gives Gemini CLI cross-tool continuity without bloating the main prompt.
---

# Read Working Memory

Start sessions with context when recent work, priorities, or unresolved flags could help.

## Connection Model

`nmem` already knows how to resolve remote access.

Priority:

1. `--api-url` flag
2. `NMEM_API_URL` / `NMEM_API_KEY`
3. `~/.nowledge-mem/config.json`
4. defaults

Prefer the config file for persistent remote setup.

## When to Use

- New Gemini CLI session
- Returning to a project after a break
- User asks for current focus, priorities, or recent progress

## Commands

Preferred:

```bash
nmem --json wm read
```

If `nmem --json wm read` reports `exists: false`, there is no briefing yet. Say that plainly and continue without inventing one.

Legacy local fallback:

```bash
cat ~/ai-now/memory.md
```

Use that fallback only for older local-only setups where the file still exists.

## How to Use the Briefing

- Read once near the start of a session
- Surface only the parts relevant to the present task
- Do not overwhelm the user with the full briefing unless asked
