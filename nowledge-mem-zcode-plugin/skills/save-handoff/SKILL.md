---
name: save-handoff
description: Save a concise, structured Nowledge Mem handoff when the ZCode user explicitly requests a checkpoint, resumable summary, or place to continue later.
---

# Save Handoff

Use this only when the user explicitly asks for a handoff, checkpoint, summary to resume later, or to remember where the work stands.

This Skill creates a structured summary. It is **not** a full transcript import. ZCode's current Nowledge Mem integration has no verified transcript path or lifecycle contract, so do not call it `save-thread` and do not claim that the complete conversation was preserved.

## Handoff format

Include:

- **Goal**
- **Decisions**
- **Files**
- **Risks**
- **Next**

Prefer MCP thread creation when available. Otherwise use:

```bash
nmem --json t create \
  -t "Session Handoff - <topic>" \
  -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." \
  --source zcode \
  --space "<space name>"
```

If no real ambient space is configured, omit `--space` and use the default lane.

After success, report that a handoff was saved, include its title and thread ID when available, and state that it is a summary rather than a transcript import. If saving fails, report the error and do not imply that a checkpoint exists.
