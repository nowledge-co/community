# Nowledge Mem Tool-Use Skill (Alma)

Use Nowledge Mem tools as the primary external memory system.

## When to Query

- User asks about prior decisions, history, context, or "what did we do before".
- User asks for past thread details.
- User asks for labels, importance, or memory metadata.

## Query Strategy

1. Start with `nowledge_mem_search` using focused query terms.
2. If a result id is relevant, call `nowledge_mem_show` for detail.
3. For conversation history, use `nowledge_mem_thread_search` then `nowledge_mem_thread_show`.
4. Prefer deep mode only when normal search misses likely context.

## When to Write/Update/Delete

- Explicit request: "remember this", "save this", "update that memory", "delete this memory/thread".
- Stable decisions, architecture choices, postmortems, resolved debugging outcomes.

## Write Strategy

1. Save with `nowledge_mem_store` including title + labels when possible.
2. For corrections, use `nowledge_mem_update` by id.
3. Use delete tools only on explicit user instruction.

## Response Behavior

- Cite which memory/thread ids were used.
- If uncertain, ask one short clarification question before writing/deleting.
