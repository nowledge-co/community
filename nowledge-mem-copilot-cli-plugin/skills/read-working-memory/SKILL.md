---
name: read-working-memory
description: Read your daily Working Memory briefing to understand current context. Contains active focus areas, priorities, unresolved flags, and recent knowledge changes. Load this automatically at the beginning of sessions for cross-tool continuity.
---

# Read Working Memory

> Start every session with context. Use Context Bundle when owner identity, agent identity, active scope, or guidance could matter; it includes Working Memory. Use Working Memory alone for the lighter daily briefing.

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

Prefer Context Bundle for startup context:

```bash
nmem --json context --source-app copilot-cli
```

Read Working Memory alone when you only need current priorities:

```bash
nmem --json wm read
```

If the runtime already knows the current project or agent lane, add `--space "<space name>"` to either command. Multi-agent orchestrators can set `NMEM_AGENT_ID="<agent-slug>"` before launching Copilot CLI. Add `NMEM_SPACE` only when that whole run should override the identity's default space. Use `NMEM_HOST_AGENT_ID` only for advanced host-id aliases.

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
3. **Avoid duplicate reads** — if Context Bundle was already loaded and includes Working Memory, do not read Working Memory again
4. **Don't overwhelm** — share only the parts relevant to what the user is working on
5. **Cross-tool continuity** — insights saved in other tools (Cursor, Claude Code, Codex) appear here

## Troubleshooting

If `nmem` is not in PATH: `pip install nmem-cli`, `pipx install nmem-cli`, or on Arch Linux `yay -S nmem-cli` / `paru -S nmem-cli`

If Nowledge Mem is on a remote server, run `nmem config client set url https://...` and `nmem config client set api-key ...` once on this machine, or use `NMEM_API_URL` / `NMEM_API_KEY` for a temporary override.
