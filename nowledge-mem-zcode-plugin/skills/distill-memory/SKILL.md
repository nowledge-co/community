---
name: distill-memory
description: Save durable Nowledge Mem facts, preferences, decisions, plans, procedures, learnings, events, and important context when a ZCode conversation produces something worth remembering; do not wait to be asked.
---

# Distill Memory

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked.

## Good candidates

- Decisions with their rationale
- Repeatable procedures and non-obvious workarounds
- Lessons from debugging, incidents, or root-cause analysis
- Durable preferences or constraints
- Plans needed to resume work later
- Important context that would otherwise be lost

Skip routine fixes, unstable work in progress, generic facts, and simple documentation answers.

## Workflow

1. Search first with MCP `memory_search` to avoid duplicates.
2. If the same decision, procedure, or preference already exists, refine it with `memory_update`.
3. Otherwise use `memory_add` with an atomic title and standalone content.
4. Use the matching `unit_type` (`fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, or `event`) and meaningful labels/importance when known.
5. At the end of a substantial task, explicitly review whether one durable memory should be added or updated.

Keep the new memory focused on what was learned or decided, not routine activity. If an ambient space is real and known, write to that space; otherwise keep the default lane.

## CLI fallback

If MCP is unavailable, use the active ambient space when one is known:

```bash
nmem --json m search "<concept>" --space "<space name>"
nmem --json m add "<content>" -t "<title>" --unit-type decision -l "<label>" -i 0.8 --space "<space name>"
```

If no real ambient space is configured, omit `--space` and use the default lane.

Use `nmem --json m update <memory_id> --content "<updated content>"` when an existing memory should evolve.
