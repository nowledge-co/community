---
name: read-working-memory
description: Read the Nowledge Mem Working Memory briefing for current context. Use at the start of a session when no briefing was injected, after a resume or compaction when the injected one may be stale, and when the user asks what they are working on.
---

# Read Working Memory

Working Memory is the user's current briefing: focus areas, priorities, unresolved flags, and recent changes. Dim injects a briefing from a SessionStart hook when Mem is reachable. Treat that injected text as the opening move of the session, not as complete evidence.

Read it again when:

- no briefing was injected (Mem was down, the CLI was missing, or the hook failed);
- the Session was resumed or compacted and the briefing may be stale;
- the user asks about their current priorities or context.

Skip it when the briefing is already loaded and nothing material changed, or when the user explicitly wants a fresh start.

## Usage

Prefer the Context Bundle when you need owner identity, AI Identity, active Space, rules, and Working Memory together. With MCP access, use the Mem tool whose description reads the Context Bundle. Without it, use the CLI:

```bash
nmem --json context --source-app dim
```

For the lighter daily briefing, use the Mem tool whose description reads Working Memory, or:

```bash
nmem --json wm read
```

If the call succeeds but reports `exists: false`, say there is no Working Memory briefing yet. If it fails, say retrieval is unavailable and continue; do not report a failed read as an empty briefing.

## Scope

Keep the configured identity and Space. When the host already knows the lane, pass it explicitly with `--space "<space name>"` or `--space-id <exact id>`; `NMEM_SPACE` is an ambient default for the whole process, not something to set per command. Do not switch lanes silently, and do not invent a Space.

## Reading the result

Reference the parts that connect to the current task; do not dump the briefing. For continuation, review, debugging, release, or prior-decision work, follow the briefing with one targeted search: see the search-memory skill.
