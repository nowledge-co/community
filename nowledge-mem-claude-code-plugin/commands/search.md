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
- If a result has `source_thread`, inspect that thread progressively with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`
- Page with a higher `--offset` only when more messages are actually needed
- Higher scores indicate better semantic matches
