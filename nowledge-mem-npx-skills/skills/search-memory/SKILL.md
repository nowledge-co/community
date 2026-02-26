---
name: search-memory
description: Search your personal knowledge base when past insights would improve response. Recognize when stored breakthroughs, decisions, or solutions are relevant. Search proactively based on context, not just explicit requests.
---

# Search Memory

> AI-powered semantic search across your personal knowledge base using Nowledge Mem.

## When to Use

**Strong signals to search:**

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

## Prerequisites

**nmem CLI** - Choose one option:

**Option 1: uvx (Recommended)**
```bash
# Install uv if needed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run nmem directly (auto-downloads)
uvx --from nmem-cli nmem --version
```

**Option 2: pip**
```bash
pip install nmem-cli
nmem --version
```

Ensure Nowledge Mem server is running at `http://localhost:14242`

## Usage

Use `nmem` CLI with `--json` flag for programmatic search:

```bash
# Basic search
nmem --json m search "your query here"

# With importance filter
nmem --json m search "API design" --importance 0.8

# With labels (multiple labels use AND logic)
nmem --json m search "authentication" -l backend -l security

# With time filter
nmem --json m search "meeting notes" -t week

# Limit results
nmem --json m search "debugging tips" -n 5
```

### Query Guidelines

- Extract semantic core from user's request
- Preserve domain terminology
- Multi-language aware (works with any language)
- Use 3-7 core concepts for best results

### Available Filters

| Flag | Description | Example |
|------|-------------|---------|
| `--importance MIN` | Minimum importance (0.0-1.0) | `--importance 0.7` |
| `-l, --label LABEL` | Filter by label (repeatable) | `-l frontend -l react` |
| `-t, --time RANGE` | Time filter | `-t today`, `-t week`, `-t month` |
| `-n NUM` | Limit results | `-n 5` |
| `--unit-type TYPE` | Filter by memory type | `--unit-type decision` |

Available unit types: `fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`.

### Understanding Results

Parse the `memories` array from JSON response. Check `score` field:

- **0.6-1.0**: Directly relevant - include in response
- **0.3-0.6**: Related context - may be useful
- **< 0.3**: Skip - not relevant enough

Results may include a `source_thread` field linking the memory to the conversation it was distilled from. Use `nmem --json t show <thread_id>` to fetch the full conversation for deeper context.

## Response Guidelines

**Found relevant memories:** Synthesize insights, cite when helpful

**No results:** State clearly, suggest distilling current discussion if valuable

## Examples

```bash
# Search for React patterns
nmem --json m search "React hooks patterns" -l frontend

# Find debugging solutions
nmem --json m search "memory leak debugging" --importance 0.6

# Recent project decisions
nmem --json m search "architecture decision" -t month -n 10
```

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Nowledge Mem](https://mem.nowledge.co)
- [Discord Community](https://nowled.ge/discord)
