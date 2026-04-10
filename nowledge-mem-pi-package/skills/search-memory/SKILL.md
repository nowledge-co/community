---
name: search-memory
description: "Search your knowledge base when past decisions, preferences, or procedures would improve the response. Covers memories from every AI tool you use."
---

# Search Memory

## When to Search

**Strong signals:**

- References prior work: "the approach we used", "like last time"
- Resumes a named feature, project, or migration
- Debugging resembles a past fix or known root cause
- Asks for rationale: "why did we choose X?"
- Recurring theme discussed in earlier sessions

**Contextual signals:**

- Complex debugging (may match past root causes)
- Architecture discussion (choices may be documented)
- Domain-specific question (conventions likely stored)
- User mentions a timeframe: "last week", "back in January"

**Skip when:**

- Fundamentally new topic with no prior context
- Generic syntax or language questions
- User explicitly requests a fresh perspective

## Retrieval Routing

### 1. Search memories (distilled knowledge)

```bash
nmem --json m search "3-7 word semantic query"
```

If the runtime already knows the active project or agent lane, add `--space <space_id>`.

### 2. Search threads (past conversations)

When the user asks about a prior session, discussion, or exact exchange:

```bash
nmem --json t search "query" --limit 5
```

### 3. Progressive thread inspection

If a thread looks relevant, load it incrementally:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase `--offset` only when more messages are actually needed.

## Key Flags

| Flag | Purpose |
|------|---------|
| `--mode deep` | Conceptual or weak first-pass results |
| `-l label` | Filter by label (multiple uses AND logic) |
| `-n limit` | Limit number of results (default: 10) |
| `--importance MIN` | Minimum importance score (0.0-1.0) |
| `--time RANGE` | Time filter: today, week, month, year |

## Examples

```bash
# Semantic search with importance filter
nmem --json m search "database optimization" --importance 0.7

# Filter by labels
nmem --json m search "React patterns" -l frontend -l react

# Recent memories only
nmem --json m search "deployment fix" --time week -n 5

# Deep mode for conceptual queries
nmem --json m search "auth architecture rationale" --mode deep
```

## Interpreting Results

**Scores:** 0.6-1.0 direct match. 0.3-0.6 related. Below 0.3, skip.

**Found:** Synthesize and cite when helpful.
**None:** State clearly. Suggest distilling if the current discussion is valuable.

## When NOT to Search

Do not search for every message. Search when there is a reasonable expectation that prior knowledge exists and would improve the response. One well-targeted search is better than three speculative ones.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/pi)
- [Troubleshooting](https://mem.nowledge.co/docs/troubleshooting)
