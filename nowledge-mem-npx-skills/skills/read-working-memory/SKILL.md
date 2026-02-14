---
name: read-working-memory
description: Read your daily Working Memory briefing to understand current context. Contains active focus areas, priorities, unresolved flags, and recent knowledge changes. Load this automatically at the beginning of sessions for cross-tool continuity.
---

# Read Working Memory

> Start every session with context. Your Working Memory is a daily briefing synthesized from your knowledge base.

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

Read the Working Memory file directly:

```bash
cat ~/ai-now/memory.md
```

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
3. **Don't overwhelm** — share only the parts relevant to what the user is working on
4. **Cross-tool continuity** — insights saved in other tools (Cursor, Claude Code, Codex) appear here

## Examples

```bash
# Read today's briefing
cat ~/ai-now/memory.md

# Check if the file exists first
test -f ~/ai-now/memory.md && cat ~/ai-now/memory.md || echo "No Working Memory found. Ensure Nowledge Mem is running with Background Intelligence enabled."
```

## About Working Memory

Working Memory is generated daily by Nowledge Mem's Background Intelligence. It synthesizes your recent knowledge activity into a concise briefing that any connected AI tool can read.

**Updated daily** at your configured briefing time (default: 8 AM local time).

**Shared across tools** — the same file is read by Claude Code, Cursor, Codex, and any other connected agent. Save an insight in one tool, and tomorrow's briefing reflects it for all tools.

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Nowledge Mem](https://mem.nowledge.co)
- [Discord Community](https://nowled.ge/discord)
