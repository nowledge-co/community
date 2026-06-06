---
name: read-working-memory
description: "Load today's Working Memory briefing at session start. Shows your current focus areas, priorities, and recent knowledge changes across all AI tools."
---

# Read Working Memory

Start every session with context. Use Context Bundle when owner identity, agent identity, active scope, or guidance could matter; it includes Working Memory. Use Working Memory alone for the lighter daily briefing.

## When to Use

**At session start:**

- Beginning of a new conversation
- Returning to a project after a break
- When context about recent work would help

**During session:**

- User asks "what am I working on?" or "what's my context?"
- User references recent priorities or decisions
- Need to understand what has been happening across tools

**Skip when:**

- Already loaded this session
- User explicitly wants a fresh start
- Working on an isolated, context-independent task

## Usage

```bash
nmem --json context --source-app pi
```

If the runtime already knows the current project or agent lane, add `--space "<space name>"`. If it knows a stable long-running agent id, add `--host-agent-id "<agent-id>"` to `nmem context`. Multi-agent orchestrators can set `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, and `NMEM_SPACE` before launching the child agent.

For only Working Memory:

```bash
nmem --json wm read
```

### What You'll Find

- **Active Focus Areas**: Topics you're currently engaged with, ranked by recent activity
- **Priorities**: Items flagged as important or needing attention
- **Unresolved Flags**: Contradictions, stale information, or items needing verification
- **Recent Activity**: What changed in your knowledge base since the last briefing
- **Deep Links**: References to specific memories for further exploration

### How to Use This Context

1. Read once at session start. Don't re-read unless asked.
2. If Context Bundle was already loaded and includes Working Memory, do not read Working Memory again.
3. If the task is clearly a continuation, review, regression, release, or prior-decision question, move directly into `search-memory` after the briefing.
4. Reference naturally when it connects to the current task.
5. Share only the parts relevant to what the user is working on.
6. Insights saved in other tools (Claude Code, Cursor, Codex) appear here automatically.

If the response includes `exists: false`, mention there's no briefing yet and continue.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/pi)
- [Troubleshooting](https://mem.nowledge.co/docs/troubleshooting)
