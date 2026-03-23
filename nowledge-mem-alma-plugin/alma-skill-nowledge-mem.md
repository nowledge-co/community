# Nowledge Mem Autonomous Memory Skill (Alma)

Use Nowledge Mem as the primary external memory system.

## Core Policy

- Operate autonomously for read/query tasks: do not ask for confirmation before searching.
- Use plugin tools first. If plugin tools are unavailable in the current chat runtime, fallback to Bash + `nmem` CLI.
- Be explicit about provenance:
  - if plugin tool/CLI executed in this turn, say so.
  - if answer came from injected recall context only, say so.

## Tool-First Execution Order

1. `nowledge_mem_query` for broad recall — results include `sourceThreadId` for thread tracing.
2. `nowledge_mem_search` for focused retrieval with filters.
3. `nowledge_mem_show` for full detail on selected memory IDs — includes `sourceThreadId`.
4. `nowledge_mem_thread_search` / `nowledge_mem_thread_show` for conversation history.
5. When a memory has a `sourceThreadId`, use `nowledge_mem_thread_show` or `nmem --json t show` progressively: start with the first page and fetch more only if the current page is not enough.

For writes:

1. `nowledge_mem_store` for new durable memory — use `unit_type` (decision, learning, preference, fact, plan, procedure, context, event) and temporal fields (`event_start`, `temporal_context`).
2. `nowledge_mem_update` for corrections.
3. `nowledge_mem_delete` / `nowledge_mem_thread_delete` only on explicit user intent.

## CLI Fallback (When Plugin Tools Are Hidden/Unavailable)

If tool calls are not exposed in the current thread, execute via Bash:

- `nmem --version`
- `nmem --help`
- `nmem --json m search "<query>" -n 5`
- `nmem --json m show <memory_id>`
- `nmem --json t search "<query>" -n 5 --source alma`
- `nmem --json t show <thread_id> -n 30 --offset 0 --content-limit 1200`
- `nmem --json m add "<content>" -t "<title>" -l tag1 -l tag2 --unit-type decision`
- `nmem --json m update <memory_id> -c "<new_content>"`

If neither plugin tools nor Bash are available, state the exact blocker once and ask for one concrete enablement step.

## Query Heuristics

- Trigger retrieval when user asks about prior decisions, historical context, previous threads, “what did we do before,” or asks to continue prior work.
- Start with memory/query search for distilled knowledge, and use thread search when the user is really asking about conversation history.
- Start normal mode first; use deep mode only when normal retrieval misses likely context.
- Prefer narrower queries over broad vague queries.
- Avoid dumping a huge thread when one page of messages is enough to answer.

## Write Heuristics

- Save information the user would want to recall later:
  - decisions (technical or personal)
  - preferences expressed during conversation
  - conclusions from debugging or analysis
  - workflow agreements or plans
  - facts the user shared about themselves, their projects, or their work
- Even casual conversations may contain preferences or decisions worth keeping. When in doubt, save — the user can always delete later.
- Skip pure pleasantries and filler that carry no informational value.

## Response Contract

- Include IDs used (memory/thread) when available.
- Keep a short “source” line:
  - `Source: nowledge_mem_search + nowledge_mem_show`
  - or `Source: nmem CLI (m search + m show)`
  - or `Source: injected recall context (no live tool call this turn)`
