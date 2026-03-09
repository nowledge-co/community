---
name: search-memory
description: Route recall across memories and threads when past work would improve the response.
---

# Search Memory

Use Nowledge Mem when prior knowledge could materially improve the answer.

## Routing

1. Start with `memory_search` for durable knowledge.
2. Use `thread_search` for prior discussions, previous sessions, or exact conversation history.
3. If a memory result includes `source_thread_id`, or thread search finds the likely conversation, use `thread_fetch_messages` progressively.

Avoid over-reading long conversations when a small page of messages is enough.
