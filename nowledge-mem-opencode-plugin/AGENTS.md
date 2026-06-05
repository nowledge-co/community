# Nowledge Mem for OpenCode

You have Nowledge Mem tools registered as `nowledge_mem_*` for cross-tool knowledge management. Use them proactively.

## Context Bundle And Working Memory

At session start, call `nowledge_mem_context_bundle` when identity, scope, or guidance may matter. It includes owner identity, agent identity, active space, guidance slots, Working Memory, and KFS paths.

Use `nowledge_mem_working_memory` only for a lightweight daily briefing or fallback on older `nmem` CLIs.

If OpenCode is launched with `NMEM_SPACE="<space name>"`, that lane is the ambient default for Context Bundle, Working Memory, search, save, and session-save flows. Legacy `NMEM_SPACE_ID` still works for older setups.

Reference relevant parts naturally as the conversation progresses. Do not re-read unless the user asks or the session context changes materially.

## Proactive Search

Search when past insights would improve the response. Do not wait for the user to say "search my memory".

**Search when:**
- The user references previous work, a prior decision, or an earlier conversation
- The task connects to a named project, feature, bug, or recurring topic
- A question resembles something discussed or resolved before
- The user asks for rationale, preferences, or established procedures
- The user uses recall language: "that approach", "like before", "the thing we decided"

**Skip when:**
- Fundamentally new topic with no prior history
- Generic factual questions answerable from general knowledge
- User explicitly asks for a fresh perspective

Use `nowledge_mem_search` for durable knowledge. Use `nowledge_mem_thread_search` when the user asks about a prior conversation specifically.

## Saving Knowledge

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked.

Use `nowledge_mem_save` with clear titles and appropriate importance scores:
- 0.8 to 1.0: major decisions, critical learnings, core preferences
- 0.5 to 0.7: useful patterns, conventions, secondary decisions
- 0.3 to 0.4: minor notes, observations, contextual details

Search first to avoid duplicates. If an existing memory already captures the same concept and the new information refines it, use `nowledge_mem_update` instead.

## Saving Sessions

Two tools for saving conversations:

**`nowledge_mem_save_thread`** captures the full message history from the current OpenCode session. It reads the conversation directly from OpenCode's SDK, formats it, and sends it to Nowledge Mem via HTTP. Idempotent: calling it multiple times will not create duplicates. Use this at natural stopping points or when the user asks to save the session.

**`nowledge_mem_save_handoff`** creates a curated summary you compose yourself: goal, decisions, files touched, open questions, next steps. Lighter and faster than a full transcript. Use this for a quick wrap-up when the full conversation is not needed.

## Long Sessions

In long sessions, OpenCode may compact earlier context. When that happens, this plugin automatically re-injects a reminder. After compaction, call `nowledge_mem_context_bundle` again when identity/scope/guidance matters, or `nowledge_mem_working_memory` for the lightweight fallback.

## Diagnostics

Use `nowledge_mem_status` to check server connectivity and configuration. Call it when tool errors suggest Nowledge Mem might not be reachable.
