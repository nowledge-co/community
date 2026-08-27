---
name: read-working-memory
description: Read the user's Working Memory briefing when current priorities, recent activity, or active focus areas matter.
---

# Read Working Memory

Use `read_context_bundle` when the session-start hook did not already provide fresh context or when a refresh is needed. It is the supported desktop MCP briefing surface and includes owner identity, resolved AI Identity, active scope, active rules, Working Memory, and KFS paths.

## When To Use

- At session start if fresh Working Memory is not already present in the session context
- When resuming work after a break
- When the user asks what they are focused on now
- When the current task clearly depends on recent priorities or active initiatives

## Usage Pattern

- If a fresh Context Bundle or `<nowledge_working_memory>` block is already present, reuse it instead of reading again immediately.
- Otherwise, call `read_context_bundle` once near the start of the session and use its Working Memory section for the current briefing.
- If the task is clearly a continuation, review, regression, release, or prior-decision question, move into `search-memory` after the briefing instead of stopping there.
- Reuse that context mentally instead of re-reading on every turn.
- Only refresh if the session context changed materially, the user asks, or the work has gone on long enough that a fresh briefing is clearly useful.

Summarize only the parts relevant to the current task.
