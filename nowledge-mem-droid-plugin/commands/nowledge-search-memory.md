---
description: Search Nowledge Mem for relevant memories and threads
argument-hint: <query>
---

# Search Memory

Search the knowledge base for memories matching the query.

## Command

```bash
nmem --json m search "$ARGUMENTS"
```

## Thread-Aware Follow Up

If the user is asking about a prior discussion or previous session, also search threads:

```bash
nmem --json t search "$ARGUMENTS" --limit 5
```

If memory results include `source_thread` or thread search finds the likely conversation, inspect it progressively:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase `--offset` only when more messages are actually needed.
