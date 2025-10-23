---
name: Distill Memory
description: Recognize breakthrough moments, blocking resolutions, and design decisions worth preserving. Detect high-value insights that save future time. Suggest distillation at valuable moments, not routine work.
---

# Distill Memory

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

```json
{
  "content": "Insight + context for future use",
  "title": "Searchable (50-60 chars)",
  "importance": 0.8,
  "labels": "tech,domain,topic"
}
```

**Content:** Outcome/insight focus, include "why", enough context

**Importance:** 0.8-1.0 major | 0.5-0.7 useful | 0.3-0.4 minor

**Labels:** 2-4 max, check existing first, lowercase-hyphenated

## Suggestion

**Timing:** After resolution/decision, when user pauses

**Pattern:** "This [type] seems valuable - [essence]. Distill into memory?"

**Frequency:** 1-3 per session typical, quality over quantity

## Troubleshooting

If the MCP is not installed, you can install it with the following command:

```bash
claude mcp add --transport http nowledge-mem http://localhost:14242/mcp --scope user
```
