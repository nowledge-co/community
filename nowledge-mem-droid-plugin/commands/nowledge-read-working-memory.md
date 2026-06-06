---
description: Read today's Working Memory briefing
---

# Read Working Memory

Load today's Working Memory briefing from Nowledge Mem.

## Command

```bash
nmem wm read
```

If the response says no briefing exists yet, say that clearly and continue normally.

## Notes

- Prefer this near session start, resume, or when recent priorities matter.
- If the runtime already knows the current project or agent lane, add `--space "<space name>"`. If a multi-agent orchestrator launched this Droid worker, set `NMEM_AGENT_ID` or `NMEM_HOST_AGENT_ID` before launch so Context Bundle resolves the right Agent Identity.
- Use `~/ai-now/memory.md` only as a fallback for older local-only **Default-space** setups.
