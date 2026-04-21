---
name: distill-memory
description: Save key decisions, procedures, or learnings so the user never has to rediscover them. Trigger when a significant decision is made, a non-obvious procedure is found, or a lesson is learned. Do not wait to be asked.
---

Capture what matters before the session ends. Save decisions, procedures, and learnings as durable memories that any connected AI tool can find later.

## What to distill

- **Decisions** with rationale ("we chose PostgreSQL because ACID is required")
- **Procedures**: non-obvious steps, workarounds, setup sequences
- **Learnings**: surprises, gotchas, corrections to prior assumptions
- **Preferences**: user's stated preferences for future reference
- **Plans** that future sessions will need to resume
- **Context** that would be lost when the session ends

## What to skip

- Routine code changes, obvious fixes, standard operations
- Work in progress that will change before it matters
- Generic information already widely known
- Simple Q&A answerable from documentation

## Workflow

If this session already exposes the Nowledge Mem MCP server:

1. Search first with `memory_search` to avoid duplicates.
2. If an existing memory captures the same concept, use `memory_update`.
3. Otherwise, create it with `memory_add`.

Otherwise:

1. Search first to avoid duplicates: `nmem --json m search "concept"`
2. If an existing memory captures the same concept, update it:
   ```bash
   nmem --json m update <memory_id> -c "updated content"
   ```
3. Otherwise, create a new memory:
   ```bash
   nmem --json m add "content" -t "Title" --unit-type decision -l "label" -s codex -i 0.8
   ```

At the end of a substantial task, explicitly check whether one durable memory should be added or updated. Do not skip that review just because the user did not ask.

## Unit types

`fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`

## Additional flags

- Temporal context: `--when past` (or `present`, `future`, `timeless`)
- Event date: `--event-start 2026-03` (for time-anchored knowledge)

## Importance scale

- `0.8-0.9`: Major decisions, important procedures, breakthroughs
- `0.5-0.7`: Useful patterns, conventions, secondary decisions
- `0.3-0.4`: Minor notes, preferences, contextual observations
- `1.0`: rare, only for critical corrections or pivotal choices

## After saving

Report what was stored, which unit type was used, and why each memory was worth keeping. One strong memory is better than three weak ones.

## Links

- [Documentation](https://mem.nowledge.co/docs)
