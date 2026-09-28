---
name: save-handoff
description: Save a concise handoff summary between OpenHands worker agents or when the user explicitly requests a task checkpoint.
trigger:
  type: keyword
  keywords:
    - handoff
    - checkpoint
    - summarize
    - resume
    - task-complete
---

# Save Handoff

> Persist a compact resumable handoff when an OpenHands agent finishes its phase, or when the user asks for a checkpoint.

## When to Use

**In Multi-Agent Orchestrations:**

- An agent node (e.g. `planner` or `architect`) finishes its scoped task and yields control to the next worker node (`coder` or `reviewer`).
- Capturing intermediate status, open blockers, and concrete next steps.

**On Explicit User Request:**

- "Save a handoff"
- "Checkpoint this work"
- "Leave me a summary of what's done"
- "Remember where we stopped"

**Skip when:**

- Normal intermediate steps within the same agent turn.
- Routine tool executions without meaningful milestone completion.

## Structure of a Handoff

A clean handoff contains:

1. **Objective**: What the agent or canvas node was tasked to do.
2. **Current State**: What was completed, modified files, passing tests.
3. **Decisions Made**: Architectural choices or constraints discovered.
4. **Next Actions**: Exact next steps for the incoming agent node or next session.
5. **Blockers/Flags**: Unresolved items requiring user attention or upstream fix.

## Usage

### Via CLI

```bash
nmem --json t create \
  --title "OpenHands Handoff: API Authentication Refactor" \
  --body "Objective: Refactor JWT middleware\nStatus: Middleware implemented, unit tests passing\nNext: Wire router in server.py" \
  --label openhands --label handoff
```

### Via MCP

Use `memory_add` with `#handoff` label and structured markdown summary:

```json
memory_add({
  "content": "### Handoff: API Authentication Refactor\n\n**Status**: Middleware implemented in `auth.py`.\n**Next**: Wire route guards in `server.py`.\n**Open**: Verify refresh token expiration policy.",
  "labels": ["handoff", "openhands", "checkpoint"]
})
```
