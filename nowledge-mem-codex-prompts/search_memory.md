---
description: Search Nowledge Mem for relevant prior work before answering
---

Search Nowledge Mem for the current task.

## Workflow

1. Rewrite the request into a short retrieval query rather than copying a long prompt verbatim.
2. Use:

```bash
nmem --json m search "best query here"
```

If the runtime already knows the active project or agent lane, add `--space "<space name>"`.

3. If the need is conceptual, historical, or the first search is weak, try a second pass with:

```bash
nmem --json m search "best query here" --mode deep
```

4. If the user is asking about a prior conversation, a previous session, or an exact discussion, use thread search too:

```bash
nmem --json t search "best query here" --limit 5
```

5. If a memory result includes `source_thread` or thread search returns the likely conversation, inspect it once for the specific messages needed:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

6. Add filters only when the task clearly implies them:
   - labels for project or domain scope
   - `--importance` for high-signal recall
   - `--event-from` / `--recorded-from` when time matters

Summarize only the strongest matches, avoid dumping huge threads, and clearly say when nothing relevant was found.

### Bounded thread reads

Search memories or threads first, then choose the specific conversation and message range needed. Call `thread_fetch_messages`, a host thread-fetch tool, or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.
