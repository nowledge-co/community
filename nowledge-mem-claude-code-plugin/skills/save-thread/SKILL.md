---
name: Save Thread
description: Save complete conversation as checkpoint. Only when user explicitly requests ("save session", "checkpoint this"). Use thread_persist to store full message history with summary.
---

# Save Thread

## When to Save

**Only when user explicitly says:**
"Save this session" | "Checkpoint this" | "Record conversation"

Never auto-save or suggest.

## Tool Usage

```json
{
  "client": "claude-code",
  "project_path": "/Users/username/dev/project-foo",
  "persist_mode": "current",
  "summary": "What was accomplished (under 100 chars)"
}
```

**project_path:** Ask if unclear

**persist_mode:** `"current"` (default) | `"all"` (only if explicitly requested)

## Thread vs Memory

Thread = full history | Memory = distilled insights (different purposes, can do both)

## Response

```
✓ Thread saved
Summary: {summary}
Messages: {count}
```

## Troubleshooting

If the MCP is not installed, you can install it with the following command:

```bash
claude mcp add --transport http nowledge-mem http://localhost:14242/mcp --scope user
```
