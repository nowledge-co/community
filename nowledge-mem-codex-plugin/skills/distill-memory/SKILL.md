---
name: distill-memory
description: Proactively distill key insights, decisions, procedures, or learnings from the current conversation into Nowledge Mem. Uses nmem CLI. Trigger when a significant decision is made, a non-obvious procedure is discovered, or a lesson is learned — without waiting for the user to ask.
---

Save durable insights from the current session into Nowledge Mem. Act proactively — do not wait to be asked.

## What to distill

- **Decisions** with rationale ("we chose PostgreSQL because ACID is required")
- **Procedures** — non-obvious steps, workarounds, setup sequences
- **Learnings** — surprises, gotchas, corrections to prior assumptions
- **Preferences** — user's stated preferences for future reference
- **Plans** that future sessions will need to resume
- **Context** that would be lost when the session ends

## What to skip

- Routine code changes, obvious fixes, standard operations
- Work in progress that will change before it matters
- Generic information already widely known
- Simple Q&A answerable from documentation

## Workflow

1. Search first to avoid duplicates: `nmem --json m search "concept"`
2. If an existing memory captures the same concept, update it:
   ```bash
   nmem --json m update <memory_id> -c "updated content"
   ```
3. Otherwise, create a new memory:
   ```bash
   nmem --json m add "content" -t "Title" --unit-type decision -l "label" -s codex -i 0.8
   ```

## Unit types

`fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`

## Additional flags

- Temporal context: `--when past` (or `present`, `future`, `timeless`)
- Event date: `--event-start 2026-03` (for time-anchored knowledge)

## Importance scale

- `0.8-0.9`: Major decisions, important procedures, breakthroughs
- `0.5-0.7`: Useful patterns, conventions, secondary decisions
- `0.3-0.4`: Minor notes, preferences, contextual observations
- `1.0`: Rare — critical corrections or pivotal choices

## After saving

Report what was stored, which unit type was used, and why each memory was worth keeping. One strong memory is better than three weak ones.

## Links

- [Documentation](https://mem.nowledge.co/docs)
