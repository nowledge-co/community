---
name: distill-memory
description: Save durable facts, preferences, decisions, procedures, and learnings to Nowledge Mem as searchable memories. Use when the conversation produces something worth keeping across sessions, without waiting to be asked.
---

# Distill Memory

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked.

## When to save

Good candidates:

- decisions with rationale ("we chose PostgreSQL because ACID is required");
- repeatable procedures or workflows;
- lessons from debugging, incidents, or root-cause analysis;
- durable preferences or constraints;
- plans a future session will need to resume cleanly;
- important context that would be lost when the session ends.

Skip routine fixes with no generalizable lesson, work in progress that will change, simple questions answerable from documentation, and generic information already widely known.

## Add or update

Use the Mem save tool, or `nmem --json m add`, when the insight is genuinely new. If an existing memory already captures the same decision, workflow, or preference and the new information refines it, update it instead: `nmem m update <id> ...`. When in doubt, search first.

At the end of a substantial task, check explicitly whether one durable memory should be added or updated.

## Quality bar

Prefer atomic, standalone memories with strong titles and clear meaning. Focus on what was learned or decided, not routine activity.

Use structured saves where supported: `--unit-type` (`fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`), `-l` labels, and `-i` importance:

- 0.8–1.0 for major decisions, architectural choices, critical learnings;
- 0.5–0.7 for useful patterns, conventions, secondary decisions;
- 0.3–0.4 for minor notes and contextual observations.

With MCP, pass the same value as `unit_type`. Omit it only when Mem should classify the save itself.

## Where it lands

In a Team workspace, a save with no named Space goes to the user's personal space ("Only me"). Read the destination Mem reports (`nmem m add` prints `Saved to <Space> (<id>)`; the MCP save returns a Space label and a share hint) instead of assuming who can see it.

To share, save with `--space "<name>"` or `--space-id <exact id>` and use a Space name from `nmem spaces list`. Use a shared Space only when the user named it or the host maps it; never choose one from a repo, folder, or prompt text. Preserve the configured ambient Space for routine saves.
