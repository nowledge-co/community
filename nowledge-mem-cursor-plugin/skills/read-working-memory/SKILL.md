---
name: read-working-memory
description: Read the user's Working Memory briefing when current priorities, recent activity, or active focus areas matter.
---

# Read Working Memory

Use the `read_working_memory` MCP tool to load the user's current focus, priorities, and unresolved context when the session-start hook did not already provide it or when a refresh is needed.

## When To Use

- At session start if fresh Working Memory is not already present in the session context
- When resuming work after a break
- When the user asks what they are focused on now
- When the current task clearly depends on recent priorities or active initiatives

## Usage Pattern

- If a fresh `<nowledge_working_memory>` block is already present, reuse it instead of reading again immediately.
- Otherwise, read it once near the start of the session.
- Reuse that context mentally instead of re-reading on every turn.
- Only refresh if the session context changed materially, the user asks, or the work has gone on long enough that a fresh briefing is clearly useful.

Summarize only the parts relevant to the current task.
