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

Read Working Memory via nmem CLI (works for both local and remote):

```bash
nmem wm read
```

If the runtime already knows the current project or agent lane, add `--space "<space name>"`.

Fallback for local-only (when nmem is not installed):

```bash
cat ~/ai-now/memory.md
```

This fallback is only for older local-only **Default-space** setups.

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

## Troubleshooting

If `nmem` is not in PATH: `pip install nmem-cli` or `pipx install nmem-cli`

If Nowledge Mem is on a remote server, run `nmem config client set url https://...` and `nmem config client set api-key ...` once on this machine, or use `NMEM_API_URL` / `NMEM_API_KEY` for a temporary override.
