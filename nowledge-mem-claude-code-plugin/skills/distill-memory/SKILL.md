---
name: distill-memory
description: Recognize breakthrough moments, blocking resolutions, and design decisions worth preserving. Detect high-value insights that save future time. Suggest distillation at valuable moments, not routine work.
---

# Distill Memory

Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.

## When to Suggest (Moment Detection)

**Breakthrough:** Extended debugging resolves, user relief ("Finally!", "Aha!"), root cause found

**Decision:** Compared options, chose with rationale, trade-off resolved

**Research:** Investigated multiple approaches, conclusion reached, optimal path determined

**Twist:** Unexpected cause-effect, counterintuitive solution, assumption challenged

**Lesson:** "Next time do X", preventive measure, pattern recognized

**Skip:** Routine fixes, work in progress, simple Q&A, generic info

## Memory Quality

**Good (atomic + actionable):**

- "React hooks cleanup must return function. Caused leaks."
- "PostgreSQL over MongoDB: ACID needed for transactions."

**Poor:** Vague "Fixed bugs", conversation transcript

## Tool Usage

Use `nmem` CLI to create memories:

```bash
nmem m add "Insight + context for future use" \
  -t "Searchable title (50-60 chars)" \
  -i 0.8
```

If an existing memory already captures the same decision, workflow, or preference and the new information refines it, update that memory instead of creating a duplicate:

```bash
nmem m update <id> -t "Updated title"
```

**Content:** Outcome/insight focus, include "why", enough context

**Importance:** 0.8-1.0 major | 0.5-0.7 useful | 0.3-0.4 minor

**Note:** For programmatic use, add `--json` flag to get JSON response

**Examples:**

```bash
# High-value insight
nmem m add "React hooks cleanup must return function. Caused memory leaks in event listeners." \
  -t "React Hooks Cleanup Pattern" \
  -i 0.9

# Decision with context
nmem m add "Chose PostgreSQL over MongoDB for ACID compliance and complex queries" \
  -t "Database: PostgreSQL" \
  -i 0.9
```

## Suggestion

**Timing:** After resolution/decision, when user pauses

**Pattern:** "This [type] seems valuable - [essence]. Distill into memory?"

**Frequency:** 1-3 per session typical, quality over quantity

## Troubleshooting

If `nmem` is not in PATH: `pip install nmem-cli`

For remote servers: create `~/.nowledge-mem/config.json` with `{"apiUrl": "...", "apiKey": "..."}`.

Run `/status` to check server connection.
