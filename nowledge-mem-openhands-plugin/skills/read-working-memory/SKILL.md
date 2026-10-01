---
name: read-working-memory
description: Read your daily Working Memory briefing to understand current context. Contains active focus areas, priorities, unresolved flags, and recent knowledge changes. Load this automatically at the beginning of sessions for cross-tool continuity.
trigger:
  type: keyword
  keywords:
    - memory
    - working memory
    - context
    - briefing
    - priorities
---

# Read Working Memory

> Start every session with context. Use Context Bundle when you need owner identity, AI Identity, active scope, active rules, and Working Memory together. Use Working Memory alone for the lighter daily briefing.

## When to Use

**At session start:**

- Beginning of a new OpenHands conversation or canvas run
- Returning to a project after a break
- When context about recent work would help
- At the start of a multi-agent canvas node (e.g. planner, coder, reviewer)

**During session:**

- User asks "what am I working on?" or "what's my context?"
- User references recent priorities or decisions
- Need to understand what's been happening across tools or agent nodes

**Skip when:**

- Already loaded this session
- User explicitly wants a fresh start
- Working on an isolated, context-independent task

## Usage

### Via MCP (Preferred in OpenHands)

When Nowledge Mem MCP is configured in OpenHands:

```json
// To load full Context Bundle (rules, identity, working memory)
read_context_bundle()

// To load Working Memory alone
read_working_memory()
```

### Via CLI

Prefer Context Bundle for startup or multi-agent canvas sessions:

```bash
nmem --json context --source-app openhands
```

Read Working Memory alone when you only need current priorities:

```bash
nmem --json wm read
```

If it succeeds but reports `exists: false`, say there is no Working Memory briefing yet.

### Multi-Agent & Orchestrator Routing

In OpenHands or SDK orchestrations (such as Raft, Multica, Paseo):

- Set `NMEM_AGENT_ID="<agent-slug>"` (e.g. `planner`, `coder`, `reviewer`, `architect`) before launching the child agent or node to identify the specialist persona.
- Set `NMEM_SPACE="<space name>"` or pass `--space "<space name>"` when that run or canvas workspace should scope to a dedicated knowledge lane.
- OpenHands `UserPromptSubmit` hook automatically injects the Context Bundle at session start.

### What You'll Find

The Working Memory briefing contains:

- **Active Focus Areas** — Topics currently engaged with, ranked by recent activity
- **Priorities** — Items flagged as important or needing attention
- **Unresolved Flags** — Contradictions, stale information, or items needing verification
- **Recent Activity** — What changed in knowledge base since the last briefing
- **Deep Links** — References to specific memories for further exploration
