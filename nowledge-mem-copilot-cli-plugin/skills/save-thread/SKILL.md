---
name: save-thread
description: Save a summary of the Copilot CLI session on explicit user request. Copilot lifecycle hooks already capture full transcripts automatically — this skill creates a concise summary thread.
---

# Save Thread

## When to Save

**Only when user explicitly says:**
"Save this session" | "Checkpoint this" | "Record conversation"

Lifecycle hooks capture full session transcripts automatically after responses, before compaction, and at session end. This skill is for on-demand summary saves.

## Tool Usage

Create a summary thread via `nmem t create`:

```bash
nmem t create "A concise summary of this session: what was discussed, what was built, and key decisions made" \
  --title "Copilot CLI: <short title from first user message>" \
  -s copilot-cli
```

**Important:** Write the summary yourself from the current conversation context. Do NOT try to invoke the stop hook script directly — it requires hook payload from Copilot CLI internals.

## Thread vs Memory

Automatic lifecycle capture stores real session messages. This skill stores a concise summary thread. Memory stores distilled insights. They are different purposes, and a valuable session can use more than one.

## Response

```text
✓ Thread saved
Summary: {summary}
Thread ID: {thread_id from nmem output}
```

## Troubleshooting

If `nmem` is not in PATH: `pip install nmem-cli`

Run `nmem status` to check server connection.
