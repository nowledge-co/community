---
name: search-memory
description: Proactively search Nowledge Mem memories and prior threads when earlier work, decisions, procedures, regressions, or exact conversation history could improve a ZCode response.
---

# Search Memory

Search before rediscovering. Use Nowledge Mem when past knowledge would make the current task sharper; do not wait for the user to say “search my memory.”

## Search signals

Search strongly when:

- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, incident, release, or subsystem
- The user asks for rationale, procedures, or exact prior conversation history
- A current debugging pattern resembles something solved earlier
- The user says “like before,” “that approach,” or similar recall language

For durable knowledge, use the MCP `memory_search` tool. For exact prior conversations, use `thread_search` and then fetch only the relevant messages with `thread_fetch_messages`. If the first results are weak, use deeper matching rather than over-fetching.

## Routing rules

1. Search memories first for decisions, facts, procedures, and learnings.
2. Search threads when the user needs the prior conversation itself.
3. Inspect the smallest result set that answers the question.
4. Keep an ambient space in the host's real lane; cross-space retrieval must be explicit.
5. Summarize only the strongest matches and say when nothing relevant was found.

## Knowledge Filesystem (optional, host-specific)

When the task needs nearby objects or a tree-like view, and the connected ZCode MCP server exposes the optional Knowledge Filesystem, use its `mem_fs` surface. The examples below are not guaranteed to be available in every host and the returned paths are Nowledge Mem object identifiers, not local operating-system paths:

```text
capabilities
recall "session token strategy" --in /memories -k 5
find /memories --label decisions --since 2026-01-01
grep "JWT rotation" /memories
cat /memories/by-id/<id>.memory.md
```

Call `capabilities` before assuming roots or verbs. These paths identify Nowledge Mem objects; they are not local operating-system paths.

## CLI fallback

If the MCP server is unavailable, use the active ambient space when one is known:

```bash
nmem --json m search "<query>" --space "<space name>"
nmem --json t search "<query>" --limit 5 --space "<space name>"
```

If no real ambient space is configured, omit `--space` and use the default lane. Do not invent a space merely because the topic changes.

Use `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200 --space "<space name>"` only after a thread result identifies a relevant conversation. If no real ambient space is configured, omit `--space`.
