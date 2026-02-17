# Nowledge Mem Autonomous Memory Skill (Alma)

Use Nowledge Mem as the primary external memory system.

## Core Policy

- Operate autonomously for read/query tasks: do not ask for confirmation before searching.
- Use plugin tools first. If plugin tools are unavailable in the current chat runtime, fallback to Bash + `nmem` CLI.
- Be explicit about provenance:
  - if plugin tool/CLI executed in this turn, say so.
  - if answer came from injected recall context only, say so.

## Tool-First Execution Order

1. `nowledge_mem_query` for broad recall.
2. `nowledge_mem_search` for focused retrieval.
3. `nowledge_mem_show` for full detail on selected memory IDs.
4. `nowledge_mem_thread_search` / `nowledge_mem_thread_show` for conversation history.

For writes:

1. `nowledge_mem_store` for new durable memory.
2. `nowledge_mem_update` for corrections.
3. `nowledge_mem_delete` / `nowledge_mem_thread_delete` only on explicit user intent.

## CLI Fallback (When Plugin Tools Are Hidden/Unavailable)

If tool calls are not exposed in the current thread, execute via Bash:

- `nmem --version`
- `nmem --help`
- `nmem --json m search "<query>" -n 5`
- `nmem --json m show <memory_id>`
- `nmem --json t search "<query>" -n 5`
- `nmem --json t show <thread_id> -m 30 --content-limit 1200`
- `nmem --json m add "<content>" -t "<title>" -l tag1 -l tag2`
- `nmem --json m update <memory_id> -c "<new_content>"`

If neither plugin tools nor Bash are available, state the exact blocker once and ask for one concrete enablement step.

## Query Heuristics

- Trigger retrieval when user asks about prior decisions, historical context, previous threads, “what did we do before,” or asks to continue prior work.
- Start normal mode first; use deep mode only when normal retrieval misses likely context.
- Prefer narrower queries over broad vague queries.

## Write Heuristics

- Write only durable information:
  - architecture decisions
  - debugging conclusions
  - workflow agreements
  - stable preferences
- Avoid storing transient chat filler.

## Response Contract

- Include IDs used (memory/thread) when available.
- Keep a short “source” line:
  - `Source: nowledge_mem_search + nowledge_mem_show`
  - or `Source: nmem CLI (m search + m show)`
  - or `Source: injected recall context (no live tool call this turn)`
