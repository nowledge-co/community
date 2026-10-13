---
name: nowledge-mem
description: Use Nowledge Mem in Alma for external memory, prior-thread recall, Context Bundle startup context, durable memory saves, and thread history lookup.
---

# Nowledge Mem

Use Nowledge Mem as Alma's external memory system.

## First Move

At the start of work that may depend on identity, active scope, Rules, recent priorities, or prior decisions, call `nowledge_mem_context_bundle`.

Use `nowledge_mem_working_memory` only when you need the lighter daily briefing or when Context Bundle is unavailable.

## Retrieval

- Use `nowledge_mem_query` for broad recall across memories, with thread fallback.
- Use `nowledge_mem_search` for focused memory retrieval.
- Use `nowledge_mem_thread_search` when the user is asking about conversation history.
- When a memory includes `sourceThreadId`, use `nowledge_mem_thread_show` to inspect the original conversation before making strong claims.

Start with a narrow query, then choose the specific conversation and message range needed.

### Bounded thread reads

Call `nowledge_mem_thread_show` or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.

## Saving

Use `nowledge_mem_store` when the conversation produces durable knowledge:

- decisions
- user preferences
- debugging conclusions
- workflow agreements
- plans that should survive the current chat
- facts about the user's projects or work

Choose `unit_type` deliberately: `decision`, `learning`, `preference`, `fact`, `plan`, `procedure`, `context`, or `event`.

Do not save pleasantries or filler. If the user explicitly asks you to remember something, save it.

## Corrections And Cleanup

- Use `nowledge_mem_update` when a remembered item is wrong but should remain.
- Use `nowledge_mem_delete` only when the user clearly wants a memory removed.
- Use thread delete tools only on explicit user intent.

## If Tools Are Hidden

If Alma does not expose plugin tools in the current thread, use Bash with `nmem` when available:

```bash
nmem --json context read --source-app alma
nmem --json m search "<query>" -n 5
nmem --json t search "<query>" -n 5 --source alma
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
nmem --json m add "<content>" -t "<title>" --unit-type decision
```

If neither plugin tools nor Bash are available, state the blocker and ask for one concrete enablement step.

## Response Contract

When memory affected the answer, include a short source line:

- `Source: nowledge_mem_query`
- `Source: nowledge_mem_search + nowledge_mem_show`
- `Source: nowledge_mem_thread_search + nowledge_mem_thread_show`
- `Source: nmem CLI`
- `Source: injected recall context`
