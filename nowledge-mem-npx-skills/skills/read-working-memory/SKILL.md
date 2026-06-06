---
name: read-working-memory
description: Read your daily Working Memory briefing to understand current context. Contains active focus areas, priorities, unresolved flags, and recent knowledge changes. Load this automatically at the beginning of sessions for cross-tool continuity.
---

# Read Working Memory

> Start every session with context. Use Context Bundle when you need owner identity, agent identity, active scope, guidance slots, and Working Memory together. Use Working Memory alone for the lighter daily briefing.

## When to Use

**At session start:**

- Beginning of a new conversation
- Returning to a project after a break
- When context about recent work would help

**During session:**

- User asks "what am I working on?" or "what's my context?"
- User references recent priorities or decisions
- Need to understand what's been happening across tools

**Skip when:**

- Already loaded this session
- User explicitly wants a fresh start
- Working on an isolated, context-independent task

## Usage

Prefer Context Bundle for startup or multi-agent sessions:

```bash
nmem --json context --source-app generic-agent
```

If the host has a stable long-running agent id, add `--host-agent-id "<agent-id>"`. Multi-agent orchestrators can set `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, and `NMEM_SPACE` before launching the child agent.

Read Working Memory alone when you only need current priorities:

```bash
nmem --json wm read
```

If it succeeds but reports `exists: false`, say there is no Working Memory briefing yet.

If the host already knows a project or agent lane, add `--space "<space name>"` to either command.

Only fall back to `~/ai-now/memory.md` for older local-only **Default-space** setups.

### What You'll Find

The Working Memory briefing contains:

- **Active Focus Areas** — Topics you're currently engaged with, ranked by recent activity
- **Priorities** — Items flagged as important or needing attention
- **Unresolved Flags** — Contradictions, stale information, or items needing verification
- **Recent Activity** — What changed in your knowledge base since the last briefing
- **Deep Links** — References to specific memories for further exploration

### How to Use This Context

1. **Read once at session start** — don't re-read unless asked
2. **Reference naturally** — mention relevant context when it connects to the current task
3. **Continuation handoff** — if the task looks like a review, regression, release, resume, or prior-decision question, move straight into `search-memory` after the briefing instead of stopping here
4. **Don't overwhelm** — share only the parts relevant to what the user is working on
5. **Avoid duplicate startup reads** — if Context Bundle was already loaded and includes Working Memory, do not read Working Memory again
6. **Cross-tool continuity** — insights saved in other tools (Cursor, Claude Code, Codex) appear here

## Examples

```bash
# Read today's briefing
nmem --json wm read

# Legacy local-only fallback
test -f ~/ai-now/memory.md && cat ~/ai-now/memory.md || echo "No Working Memory found. Ensure Nowledge Mem is running with Background Intelligence enabled."
```

## About Working Memory

Working Memory is generated daily by Nowledge Mem's Background Intelligence. It synthesizes your recent knowledge activity into a concise briefing that any connected AI tool can read.

**Updated daily** at your configured briefing time (default: 8 AM local time).

**Shared across tools** — connected tools read the same lane's briefing. Save an insight in one tool, and that lane's next briefing reflects it for the others.

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Nowledge Mem](https://mem.nowledge.co)
- [Discord Community](https://nowled.ge/discord)

## Native Connector

These skills work in any agent via CLI. For auto-recall, auto-capture, and graph tools, check if your agent has a native Nowledge Mem connector — run the `check-integration` skill or see https://mem.nowledge.co/docs/integrations
