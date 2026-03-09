---
name: search-memory
description: Search the user's personal knowledge base when past insights would improve the response. Trigger proactively for continuity, recurring bugs, design rationale, and remembered workflows.
---

# Search Memory

Use Nowledge Mem when prior knowledge could materially improve the answer.

This Gemini integration is CLI-first. Use direct `nmem` composition whenever that produces a cleaner query.

## Strong Signals

- Current task connects to previous work
- User asks why a decision was made
- Problem resembles a past bug or implementation
- User references "that approach", "last time", or similar recall phrases

## Skip When

- Topic is genuinely new
- User wants a fresh perspective
- Question is generic syntax with no continuity signal

## Command

Use `nmem` in JSON mode:

```bash
nmem --json m search "query"
```

If the recall need is conceptual or the first pass is weak, use deep search:

```bash
nmem --json m search "query" --mode deep
```

Useful filters:

```bash
nmem --json m search "auth rotation" --importance 0.7
nmem --json m search "React hooks" -l frontend -l react
nmem --json m search "incident review" --recorded-from 2026-02-01 -n 5
```

Use thread search when the user is really asking about a past conversation, prior session, or exact discussion:

```bash
nmem --json t search "query" --limit 5
```

If a memory result includes a `source_thread` or thread search returns a strong hit, inspect the conversation progressively instead of loading the whole thread at once:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase `--offset` only when more of the conversation is actually needed.

## Result Quality

- `score >= 0.6`: directly relevant
- `0.3 <= score < 0.6`: related context
- `< 0.3`: usually skip

Mention source threads when they add useful historical context.
