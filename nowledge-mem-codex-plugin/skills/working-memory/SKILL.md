---
name: working-memory
description: "Load your current context at session start. Shows what you were working on, active priorities, and unresolved flags. Also trigger when resuming after a break or when the user asks what am I working on."
---

Start with what matters. For full startup context, use Context Bundle: it resolves owner identity, the consuming agent identity, active scope, guidance slots, Working Memory, and KFS paths. Working Memory is the lighter daily briefing of active focus areas, priorities, and recent knowledge changes.

## Preferred path

If this session exposes the Nowledge Mem MCP server and you need the full startup contract, prefer `read_context_bundle`.

Otherwise use `read_working_memory` for a lightweight daily briefing, or the CLI Context Bundle fallback:

```bash
nmem --json context --source-app codex
```

For only Working Memory:

```bash
nmem --json wm read
```

If the runtime already knows the current project or agent lane, add `--space "<space name>"`. Multi-agent orchestrators can set `NMEM_AGENT_ID="<agent-slug>"` before launching Codex so the Context Bundle resolves the right Agent Identity. Add `NMEM_SPACE` only when that whole run should override the identity's default space. Use `NMEM_HOST_AGENT_ID` only for advanced host-id aliases.

## What you'll find

- **Identity and scope**: owner identity, agent identity, active space, and guidance slots when using Context Bundle
- **Focus areas**: what you're actively working on, ranked by recent activity
- **Priorities**: items flagged as important or needing attention
- **Unresolved flags**: contradictions, stale information, or items to verify
- **Recent changes**: what shifted in your knowledge base since the last briefing

## How to use it

- Summarize only the parts relevant to the task. If Context Bundle was loaded, do not separately read Working Memory unless the user asks.
- If the task is clearly a continuation, review, release, regression, connector, or prior-decision question, move directly into `search-memory` after the briefing instead of stopping here.
- If `exists: false` or the command fails, say there is no briefing yet and continue normally.
- Share only the parts relevant to what the user is doing now.

## When to read

- Beginning of a new session
- Returning to a project after a break
- User asks "what am I working on?" or "what's my context?"

## When to skip

- Already loaded this session (do not re-read unless the user asks)
- User explicitly wants a fresh start
- Task is isolated and needs no prior context

## Links

- [Working Memory](https://mem.nowledge.co/docs/advanced-features#working-memory)
- [Getting started](https://mem.nowledge.co/docs)
