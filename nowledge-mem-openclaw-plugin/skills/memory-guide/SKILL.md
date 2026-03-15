---
name: nowledge-mem-guide
description: >
  Cross-AI personal knowledge graph memory (Nowledge Mem). Stores memories from this tool,
  Claude Code, Cursor, browser capture, imported documents, and more. Use when: (1) the user
  asks about prior work, decisions, preferences, people, dates, plans, or todos, (2) the user
  references something discussed before or says "remind me" / "what did we decide" / "what was
  I working on", (3) the conversation produces a decision, preference, plan, or learning worth
  keeping, (4) the user wants to browse recent activity or explore how ideas connect, (5) the
  user asks about a past conversation or wants to find a specific thread.
---

# Nowledge Mem

## Search (memory_search)

Use natural language queries. This is semantic search, not file search.

- "database choice for task events" (not "MEMORY.md" or file paths)
- "meeting with Sarah about API redesign"
- "deployment procedure for production"

Results include `matchedVia` (scoring breakdown), `importance`, `labels`, `sourceThreadId`.

When results include `relatedThreads`, use `nowledge_mem_thread_fetch` with the `threadId` for full conversation context. Start with a small page; fetch more via `offset` + `limit` only when needed.

Bi-temporal filters narrow results by time:

- `event_date_from` / `event_date_to` — when the fact happened
- `recorded_date_from` / `recorded_date_to` — when it was saved

## Save (nowledge_mem_save)

Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.

Structure saves:

- `unit_type`: fact | preference | decision | plan | procedure | learning | context | event
- `labels`: lowercase-hyphenated topic tags
- `importance`: 0.0-1.0 (most: 0.5; key decisions/preferences: 0.7-0.9)
- `event_start` / `event_end`: ISO dates when temporal

Skip trivial exchanges, greetings, and meta-conversation about memory itself.

## Connections (nowledge_mem_connections)

Pass a `memoryId` from search results to explore related memories, evolution chains, and source documents. Edge types: EVOLVES, CRYSTALLIZED_FROM, SOURCED_FROM, MENTIONS.

## Timeline (nowledge_mem_timeline)

Browse recent activity grouped by day. Filter by `event_type` or exact `date_from` / `date_to` range.

## Threads (nowledge_mem_thread_search + nowledge_mem_thread_fetch)

Find past conversations by keyword, then progressively fetch messages. Threads span all sources: this tool, other AI tools, browser capture, imports.

## Working Memory (nowledge_mem_context)

Read the user's daily briefing (priorities, active projects, flags). Patch a specific section with `patch_section` + `patch_content`/`patch_append` when the conversation updates a priority or resolves a flag.

## Important

- Search uses natural language queries, not file paths. Never search for "MEMORY.md" or "memory/*.md".
- When `relatedThreads` appear in results, they often contain the most useful context.
- Use tools directly; do not tell the user to "check your memory."
