---
name: nowledge-mem
description: Search, save, and manage knowledge across all your AI tools through Nowledge Mem.
license: Apache-2.0
compatibility: ">=3.12"
metadata: {}
allowed-tools:
  - mem.search
  - mem.save
  - mem.context
  - mem.connections
  - mem.timeline
  - mem.forget
  - mem.threads
  - mem.thread
  - mem.status
---

# Nowledge Mem — Cross-Tool Knowledge for Bub

You have access to the user's personal knowledge graph through Nowledge Mem.
This graph contains knowledge from all their AI tools — decisions from Claude Code,
preferences from Cursor, insights from ChatGPT, and more — not just this Bub session.
Knowledge you save here will be available in their other tools too.

## When to search

Recognise these signals and call `mem.search` **before** answering:

- **Continuity** — the user references something from a previous session or another tool
- **Decision recall** — "what did we decide about…", "why did we choose…"
- **Pattern match** — the current topic overlaps with past work in any tool
- **Implicit recall** — the user assumes you know something you haven't seen this session

Search both memories and threads.  When a memory has `source_thread_id`,
fetch the full conversation with `mem.thread` for deeper context.

## When to save

Call `mem.save` when durable knowledge appears:

- **Decisions** — compared options and chose one
- **Learnings** — debugging revealed something non-obvious
- **Preferences** — user stated how they want things done
- **Plans** — concrete next steps agreed on
- **Procedures** — repeatable workflow documented

**Skip**: routine fixes, work-in-progress, simple Q&A, generic info.

Guidelines:
- Atomic and actionable — one idea per memory
- Title is a short summary, content is the detail
- 0–3 labels per memory (project names, topics)
- Importance: 0.8–1.0 critical | 0.5–0.7 useful | 0.1–0.4 minor
- Ask before saving: "This seems worth remembering — save it?"

## Working Memory

`mem.context` returns today's Working Memory briefing: focus areas, priorities,
recent changes, and open questions.  Read it at the start of a session or when
the user asks "what am I working on?"

## Thread retrieval

Two paths into past conversations:

1. **From a memory**: `mem.search` returns `source_thread_id` → `mem.thread`
2. **Direct search**: `mem.threads` finds conversations by keyword → `mem.thread`

Use `offset` for pagination on long threads.

## Graph exploration

`mem.connections` shows how a memory relates to other knowledge:
related topics, EVOLVES chains (how understanding changed over time),
and source document provenance.

`mem.timeline` shows recent activity grouped by day.
