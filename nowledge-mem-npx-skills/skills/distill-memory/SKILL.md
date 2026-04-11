---
name: distill-memory
description: Capture breakthrough moments and valuable insights as searchable memories in your knowledge base.
---

# Distill Memory

Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.

## When to Save

Good candidates include:

- decisions with rationale ("we chose PostgreSQL because ACID is required")
- repeatable procedures or workflows
- lessons from debugging, incidents, or root cause analysis
- durable preferences or constraints
- plans that future sessions will need to resume cleanly
- important context that would be lost when the session ends

Skip routine fixes with no generalizable lesson, work in progress that will change, simple Q&A answerable from documentation, and generic information already widely known.

## Add vs Update

- Use `nmem --json m add` when the insight is genuinely new.
- If an existing memory already captures the same decision, workflow, or preference and the new information refines it, use `nmem m update <id> ...` instead of creating a duplicate.
- At the end of a substantial task, explicitly check whether one durable memory should be added or updated.

Prefer atomic, standalone memories with strong titles and clear meaning. Focus on what was learned or decided, not routine chatter.

Use structured saves when possible: `--unit-type` (decision, procedure, learning, preference, event), `-l` labels, `-i` importance (0.8–1.0 major decisions, 0.5–0.7 useful patterns, 0.3–0.4 minor notes).

## Native Plugin

These skills work in any agent via CLI. For auto-recall, auto-capture, and graph tools, check if your agent has a native Nowledge Mem plugin — run the `check-integration` skill or see https://mem.nowledge.co/docs/integrations
