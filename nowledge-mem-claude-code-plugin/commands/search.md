---
description: Search Nowledge Mem for relevant memories
argument-hint: <query>
---

# Search Memory

Search the knowledge base for memories matching the query.

## Command

```bash
nmem --json m search "$ARGUMENTS"
```

## Options

Filter by importance threshold:

```bash
nmem --json m search "$ARGUMENTS" --importance 0.7
```

Filter by label:

```bash
nmem --json m search "$ARGUMENTS" --label decision
```

## Output

Returns matching memories with:
- **id**: Memory identifier
- **title**: Searchable title
- **content**: Full memory content
- **score**: Relevance score
- **source_thread**: Original conversation (if distilled from a thread)

## Usage Tips

- Use specific keywords that match stored memory titles
- If the user is asking about a prior conversation or session, also try `nmem --json t search "$ARGUMENTS" --limit 5`
- If a result has `source_thread`, inspect that thread once for the specific messages needed with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`
- Use a known target `--offset` once; do not advance through pages
- Higher scores indicate better semantic matches

### Bounded thread reads

Search memories or threads first, then choose the specific conversation and message range needed. Call `thread_fetch_messages`, a host thread-fetch tool, or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.
