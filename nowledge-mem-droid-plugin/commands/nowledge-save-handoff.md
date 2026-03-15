---
description: Save a resumable handoff summary for the current Droid session
---

# Save Handoff

Create a compact resumable handoff summary for the current work.

This is intentionally a handoff summary, not a transcript-backed thread import.

## Command

```bash
nmem --json t create \
  -t "Session Handoff - <topic>" \
  -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." \
  -s droid
```

## Handoff Format

Include:

- Goal
- Decisions
- Files
- Risks
- Next

Never present this as `save-thread`.
