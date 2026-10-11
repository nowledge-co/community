---
name: distill-memory
description: Save durable decisions, insights, procedures, and learnings from iCode sessions into Nowledge Mem. Use when a durable fact emerges — a decision, preference, procedure, or important context — even if the user did not ask.
---

Capture what future sessions will need. In iCode, prefer the Nowledge Mem MCP
tools when loaded: `memory_add` for new memories, `memory_update` to refine an
existing one (search first; prefer update over duplicates). CLI fallback:
`nmem m add "content" --title "Short title" --importance 0.8`.

**Save proactively when the conversation produces a durable fact, preference,
decision, plan, procedure, learning, event, or important context. Do not wait
to be asked.**

## What is durable

- Decisions and their rationale (chosen approach, rejected alternatives)
- Discovered procedures, workarounds, and environment quirks
- User preferences and conventions that recur across sessions
- Architecture or naming decisions a future session would otherwise relitigate

## What is not durable

- One-off task details already captured in code, commits, or docs
- Session-local state (current file, current error) with no future value

Keep titles short and content specific; include exact names, versions, and
paths when they matter. Record the source of the knowledge when it came from
real files or commands, and set a claim status other than asserted only when
the fact is genuinely unverified.
