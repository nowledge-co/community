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

5. If a memory result includes `source_thread` or thread search returns the likely conversation, inspect it progressively:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

6. Add filters only when the task clearly implies them:
   - labels for project or domain scope
   - `--importance` for high-signal recall
   - `--event-from` / `--recorded-from` when time matters

Summarize only the strongest matches, avoid dumping huge threads, and clearly say when nothing relevant was found.
