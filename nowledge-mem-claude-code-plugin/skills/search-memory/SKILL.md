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

```json
{
  "query": "3-7 core concepts",
  "limit": 10,
  "mode": "normal"
}
```

**Query:** Extract semantic core, preserve terminology, multi-language aware

**Modes:** `normal` (default fast) | `deep` (comprehensive when needed)

**Scores:** 0.6-1.0 direct | 0.3-0.6 related | <0.3 skip

**Optional:** `"filter_labels": "backend,architecture"`

## Response

Found: Synthesize, cite when helpful
None: State clearly, suggest distilling if current discussion valuable

## Troubleshooting

If the MCP is not installed, you can install it with the following command:

```bash
claude mcp add --transport http nowledge-mem http://localhost:14242/mcp --scope user
```
