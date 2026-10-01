---
name: distill-memory
description: Capture breakthrough moments, architecture decisions, and valuable insights as searchable memories in Nowledge Mem.
trigger:
  type: keyword
  keywords:
    - save
    - remember
    - learn
    - distill
    - note
    - decision
---

# Distill Memory

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked.

## When to Save

Good candidates include:

- decisions with rationale ("we chose SQLite with WAL mode because concurrent reader throughput is required")
- repeatable procedures or multi-step deployment workflows
- lessons from debugging, incidents, or root cause analysis
- durable user preferences, style guidelines, or architecture constraints
- plans that future OpenHands sessions or worker agents will need to resume cleanly
- important context that would otherwise be lost when the agent session terminates

Skip routine fixes with no generalizable lesson, temporary work in progress, simple Q&A answerable directly from docs, and generic facts already widely known.

## Usage

### Via MCP (Preferred)

Add a new memory:

```json
memory_add({
  "content": "In OpenHands orchestrations, specialist worker nodes should pass NMEM_AGENT_ID to maintain identity-aware memory tracking.",
  "labels": ["openhands", "architecture", "multi-agent"]
})
```

Link related memories:

```json
memory_relation_add({
  "source_id": "<memory-1-id>",
  "target_id": "<memory-2-id>",
  "relation_type": "depends_on"
})
```

### Via CLI

Add new memory:

```bash
nmem --json m add "Decision: use WAL mode for SQLite" --label architecture --label database
```

Update an existing memory:

```bash
nmem --json m update <memory-id> --content "Updated rationale: ..."
```

## Distill vs Update

- Use `memory_add` (`nmem m add`) when the insight is genuinely new.
- Use `memory_update` / `memory_supersede` (`nmem m update`) when refining, correcting, or replacing an existing memory.
- Prefer adding meaningful labels (`architecture`, `decision`, `openhands`, `convention`) to assist subsequent graph discovery.
