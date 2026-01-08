---
name: Search Memory
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

**Query:** Extract semantic core, preserve terminology, multi-language aware

**Filters:**
- `--importance MIN`: Minimum importance score (0.0-1.0)
- `-l, --label LABEL`: Filter by label (can specify multiple)
- `-t, --time RANGE`: Time filter (today, week, month, year)
- `-n NUM`: Limit number of results (default: 10)

**JSON Response:** Parse `memories` array, check `score` field for relevance

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

If `nmem` is not available:

**Option 1 (Recommended): Use uvx**
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run nmem (no installation needed)
uvx nmem --version
```

**Option 2: Install with pip**
```bash
pip install nmem
nmem --version
```
