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

If memory results include `source_thread` or thread search finds the likely conversation, inspect it once for the specific messages needed:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase `--offset` only when more messages are actually needed.

### Bounded thread reads

Search memories or threads first, then choose the specific conversation and message range needed. Call `thread_fetch_messages`, a host thread-fetch tool, or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.
