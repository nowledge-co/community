---
name: read-working-memory
description: Read the user's daily Working Memory briefing at session start or when recent priorities matter. This gives Gemini CLI cross-tool continuity without bloating the main prompt.
---

# Read Working Memory

Use `nmem --json wm read` for the user's current priorities, unresolved flags, and recent context.

## When to Use

- At session start
- When resuming work after a break
- When the user asks what they are focused on now
- When the current task clearly depends on recent priorities or active initiatives

## Usage Pattern

- Read once near the start of a session.
- Reuse that context mentally instead of re-reading on every turn.
- Refresh only if the user asks, the session context changed materially, or a long-running session clearly needs it.
