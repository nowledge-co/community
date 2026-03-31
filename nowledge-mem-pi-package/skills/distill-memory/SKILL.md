---
name: distill-memory
description: "Save decisions, insights, preferences, and procedures as durable memories. Fires when the conversation produces knowledge worth keeping across sessions."
---

# Distill Memory

Save proactively when the conversation produces knowledge worth keeping. Do not wait to be asked.

## When to Distill

**Decision with rationale:** Compared options, chose with reasoning, trade-off resolved.

**Repeatable procedure:** Step-by-step workflow the user will need again.

**Lesson from debugging:** Root cause found, unexpected behavior explained, prevention identified.

**Durable preference:** Coding style, tooling choice, naming convention, architectural stance.

**Plan for future sessions:** Agreed next steps, phased approach, deferred work items.

**Skip:** Routine fixes, work in progress, simple Q&A, generic information.

## Usage

```bash
nmem --json m add "content" -t "Title" --unit-type <type> -i <importance>
```

### Valid Unit Types

`fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`

### Importance Scale (Descending)

| Range | Meaning | Examples |
|-------|---------|---------|
| 0.8-1.0 | Major | Architecture decisions, production incident fixes, core preferences |
| 0.5-0.7 | Useful | Debugging insights, workflow improvements, project conventions |
| 0.3-0.4 | Minor | Small tips, one-off observations, context notes |

## Examples

```bash
# High-value decision
nmem --json m add "Chose PostgreSQL over MongoDB: need ACID for transaction integrity and complex joins across order/inventory tables" \
  -t "Database: PostgreSQL for ACID" \
  --unit-type decision -i 0.9

# Procedure
nmem --json m add "Deploy sequence: run migrations first, then canary at 5%, watch error rate for 10 min, promote to full rollout" \
  -t "Production Deploy Procedure" \
  --unit-type procedure -i 0.7

# Preference
nmem --json m add "Prefer named exports over default exports in TypeScript. Makes refactoring and IDE navigation faster." \
  -t "TS: Named Exports Preferred" \
  --unit-type preference -i 0.6
```

## Add vs Update

Search first to avoid duplicates. If a memory already captures the same concept and the new information refines it, update instead of creating a new entry:

```bash
nmem --json m update <memory_id> -c "updated content"
```

One strong memory is better than three weak ones.

## Memory Quality

**Good (atomic, actionable):**
- "React hooks cleanup must return a function. Caused memory leaks in event listeners."
- "PostgreSQL over MongoDB: ACID needed for transaction integrity."

**Poor:** Vague "fixed some bugs", conversation transcript dumps, overly broad summaries.

## When to Skip

Do not distill routine work. If the user wouldn't miss it when it's gone, it shouldn't exist. Quality over quantity: 1-3 distilled memories per session is typical.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/pi)
- [Troubleshooting](https://mem.nowledge.co/docs/troubleshooting)
