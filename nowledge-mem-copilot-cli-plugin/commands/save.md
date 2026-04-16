---
description: Save current session to Nowledge Mem
---

# Save Session

Save the current Copilot CLI session to Nowledge Mem.

## Usage

Sessions are captured **automatically** by the Stop hook after each response. To explicitly save a summary right now, create a thread directly:

```bash
nmem t create "A concise summary of this session: what was discussed, what was built, and key decisions made" \
  --title "Copilot CLI: <short title>" \
  -s copilot-cli
```

## When to Use

- When the user explicitly says "save this session" or "checkpoint this"
- The Stop hook already captures the full transcript — this is for on-demand summaries

## Output

The command returns the thread ID. Report it to the user:

```
✓ Thread saved
Thread ID: <thread_id>
```

**Note:** The Stop hook already captures full session transcripts automatically. This command creates a summary thread for explicit saves.
