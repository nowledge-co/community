---
name: nowledge-mem
description: Cross-tool knowledge for Amp. Read startup Context Bundle, search past decisions and conversations, save durable insights, and capture sessions as searchable threads with Nowledge Mem.
---

# Nowledge Mem

You have Nowledge Mem tools (`nowledge_mem_*`) for cross-tool knowledge management. Use them proactively.

## At session start

Call `nowledge_mem_context_bundle` at the start of every session. It returns owner identity, resolved AI Identity, active scope, active rules, Working Memory, and KFS paths in one stable contract. Use `nowledge_mem_working_memory` only for a lightweight daily briefing or as a fallback when the Context Bundle is unavailable.

## When to search (`nowledge_mem_search`)

Search proactively when past context would improve the answer. Strong signals:

- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, or subsystem
- A debugging pattern resembles something solved earlier
- The user asks for rationale, preferences, procedures, or recurring workflow details
- The user uses recall language: "that approach", "like before", "the pattern we used"

Do not search when the topic is fundamentally new, when the answer is generic documentation, or when the user explicitly wants a fresh perspective.

## When to search threads (`nowledge_mem_thread_search`)

- The user asks about a prior conversation or exact session history
- A memory result references a source thread

## When to save or update

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked. Search first to check for related memories:

- If a related memory exists, call `nowledge_mem_update` to refine it
- If the insight is genuinely new, call `nowledge_mem_save`

Good candidates: decisions with rationale, repeatable procedures, lessons from debugging, durable preferences, plans future sessions will resume. Skip routine fixes, in-progress work, and generic Q&A answerable from documentation.

## When to save the session (`nowledge_mem_save_thread`)

- The user asks to save the conversation or "remember this session"
- A long, productive session is wrapping up
- The conversation produced decisions or context worth preserving as a full thread

Session capture also happens automatically at the end of each agent turn; the tool is the explicit, on-demand path and is idempotent.

## When to save a handoff (`nowledge_mem_save_handoff`)

Use a handoff when you want a curated summary rather than the full transcript: provide a topic and a structured summary (Goal, Decisions, Key files, Risks, Next steps).
