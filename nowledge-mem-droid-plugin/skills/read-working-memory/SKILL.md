---
name: read-working-memory
description: Read your daily Working Memory briefing to understand current context. Load it near session start for cross-tool continuity, then reuse that context instead of re-reading it repeatedly.
---

# Read Working Memory

> Start each Droid session with context. Use Context Bundle when identity, agent lane, scope, or Rules could matter; it includes Working Memory. Use Working Memory alone for the lighter daily briefing.

## When to Use

Use this near session start, resume, clear, or when the user asks about recent priorities.

Skip when:

- you already loaded it this session
- the user explicitly wants a fresh start
- the task is clearly isolated and context-independent

## Usage

Prefer Context Bundle for full startup context:

```bash
nmem --json context --source-app droid
```

Read Working Memory alone for current priorities:

```bash
nmem wm read
```

If the runtime already knows the current project or agent lane, either add `--space "<space name>"` or launch the whole session with `NMEM_SPACE="<space name>"`. Multi-agent orchestrators can set `NMEM_AGENT_ID="<agent-slug>"` before launching Droid so the Context Bundle resolves the right AI Identity. Use `NMEM_HOST_AGENT_ID` only for advanced external aliases.

Fallback for older local-only setups:

```bash
cat ~/ai-now/memory.md
```

This fallback is only for older local-only **Default-space** setups.

## Response Contract

- Read once, then reuse the context mentally
- If Context Bundle was already loaded and includes Working Memory, do not read Working Memory again
- If the task is clearly a continuation, review, regression, release, or prior-decision question, move into `search-memory` after the briefing instead of stopping there
- Reference only the parts relevant to the current task
- Do not overwhelm the user with the full briefing unless they asked for it
