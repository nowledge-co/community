# Distill Memory

Save durable insights to Nowledge Mem autonomously. Don't wait to be asked — save proactively when the conversation produces lasting value.

## When to Save

**Save proactively when the conversation produces:**
- A decision (architecture choice, tool selection, process change)
- A preference (code style, workflow, tool configuration)
- A plan (multi-step task design, roadmap item)
- A procedure (how to set up, how to debug, how to deploy)
- A learning (bug root cause, pitfall discovered, pattern recognized)
- Important context (project background, stakeholder constraint)

## Usage

**Primary (MCP)**:
```
mcp__nowledge-mem__add_memory
  content: "<what was decided or learned>"
  title: "<short descriptive title>"
  importance: 0.3-1.0
  tags: ["<relevant tags>"]
```

**Fallback (CLI)**:
```bash
nmem --json m add "JWT refresh failures came from clock skew." \
  --title "JWT refresh failures traced to clock skew" \
  --importance 0.9 --unit-type learning -l auth -s proma
```

## Importance Guide

| Level | When |
|-------|------|
| 0.3-0.5 | Minor preference, small tip |
| 0.5-0.7 | Useful pattern, reusable snippet |
| 0.7-0.9 | Important decision, hard-won lesson |
| 0.9-1.0 | Critical architecture choice, security rule |

## Add vs Update

- **Add** (`mcp__nowledge-mem__add_memory`): new insight, first time capturing something
- **Update** (`mcp__nowledge-mem__update_memory`): refining or correcting an existing memory
- When unsure, search first to check if a related memory already exists

## Guidance

1. Save after the decision is made, not mid-discussion
2. Include enough context for your future self (or another AI) to understand 3 months later
3. Don't save trivialities — "we used port 3000" doesn't belong unless the choice of port was significant
4. Built-in `mcp__mem__add_memory` is for session-level notes; use nmem for cross-session durability
