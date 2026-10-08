---
name: search-memory
description: Search memory store when past insights would improve response. Recognize when user's stored breakthroughs, decisions, or solutions are relevant. Search proactively based on context, not just explicit requests.
---

# Search Memory

## When to Search (Autonomous Recognition)

**Strong signals:**

- Continuity: Current topic connects to prior work
- Pattern match: Problem resembles past solved issue
- Decision context: "Why/how we chose X" implies documented rationale
- Recurring theme: Topic discussed in past sessions
- Implicit recall: "that approach", "like before"

**Contextual signals:**

- Complex debugging (may match past root causes)
- Architecture discussion (choices may be documented)
- Domain-specific question (conventions likely stored)

**Skip when:**

- Fundamentally new topic
- Generic syntax questions
- Fresh perspective explicitly requested

## Tool Usage

Use `nmem` CLI with `--json` flag for programmatic search:

```bash
# Basic search
nmem --json m search "3-7 core concepts"

# With filters
nmem --json m search "API design" --importance 0.8

# With labels (multiple labels use AND logic)
nmem --json m search "authentication" -l backend -l security

# With time filter
nmem --json m search "meeting notes" -t week
```

Only add `--space "<space name>"` when the user or environment explicitly provided that existing Mem space (for example `NMEM_SPACE`). Never infer a space from the current folder, git repository, branch, or project name.

**Query:** Extract semantic core, preserve terminology, multi-language aware

**Filters:**
- `--importance MIN`: Minimum importance score (0.0-1.0)
- `-l, --label LABEL`: Filter by label (can specify multiple)
- `-t, --time RANGE`: Time filter (today, week, month, year)
- `-n NUM`: Limit number of results (default: 10)

**JSON Response:** Parse `memories` array, check `score` field for relevance

Use thread search when the user is really asking about a prior conversation, previous session, or exact discussion:

```bash
nmem --json t search "query" --limit 5
```

If a memory result includes `source_thread` or thread search finds the likely conversation, inspect it once for the specific messages needed:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase `--offset` only when more messages are actually needed.

**Scores:** 0.6-1.0 direct | 0.3-0.6 related | <0.3 skip

**Examples:**

```bash
# Search with importance filter
nmem --json m search "database optimization" --importance 0.7

# Search with multiple labels
nmem --json m search "React patterns" -l frontend -l react

# Search recent memories
nmem --json m search "bug fix" -t week -n 5
```

## Response

Found: Synthesize, cite when helpful
None: State clearly, suggest distilling if current discussion valuable

## Troubleshooting

If `nmem` is not in PATH: `pip install nmem-cli`, or on Arch Linux `yay -S nmem-cli` / `paru -S nmem-cli`

For remote servers: run `nmem config client set url https://...` and `nmem config client set api-key ...` once on this machine.

Run `/status` to check server connection.

### Bounded thread reads

Search memories or threads first, then choose the specific conversation and message range needed. Call `thread_fetch_messages`, a host thread-fetch tool, or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.
