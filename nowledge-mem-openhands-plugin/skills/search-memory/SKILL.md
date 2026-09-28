---
name: search-memory
description: Search your personal knowledge base when past insights would improve response. Recognize when stored breakthroughs, decisions, or solutions are relevant. Search proactively based on context, not just explicit requests.
trigger:
  type: keyword
  keywords:
    - search
    - recall
    - remember
    - past
    - previous
    - decision
    - canvas
---

# Search Memory

> Proactive search across your personal knowledge base using Nowledge Mem in OpenHands.

## When to Use

**Strong signals — search when:**

- the user references previous work, a prior fix, or an earlier decision
- the task resumes a named feature, bug, refactor, incident, or subsystem
- the task is a review, regression, release, docs-alignment, or connector-behavior question
- an OpenHands specialist node needs architecture guidelines agreed on by previous nodes
- a debugging pattern resembles something solved earlier
- the user asks for rationale, preferences, procedures, or recurring workflow details
- the user uses implicit recall language: "that approach", "like before", "the pattern we used"

**Contextual signals — consider searching when:**

- complex debugging where prior context would narrow the search space
- architecture discussion that may intersect with past decisions
- domain-specific conventions established previously

## Usage

### Via MCP (Preferred)

Search memories:

```json
memory_search({
  "query": "PostgreSQL transaction isolation levels"
})
```

Search prior conversation threads:

```json
thread_search({
  "query": "database connection pool leak fix"
})
```

Explore knowledge graph around an entity:

```json
explore_graph({
  "query": "authentication service"
})
```

### Via CLI

Search memories:

```bash
nmem --json m search "authentication service"
```

Search threads:

```bash
nmem --json t search "authentication service"
```

If scoped to a specific space:

```bash
nmem --json m search "authentication service" --space "Backend"
```

## Search Strategy

1. **Be specific**: query with technical terms, error messages, or architectural names.
2. **Follow graph links**: when a memory contains `deepLinks` or entity relations, inspect related nodes if more context is needed.
3. **Do not repeat**: if a recent search returned empty results, do not re-run identical searches within the same turn.
