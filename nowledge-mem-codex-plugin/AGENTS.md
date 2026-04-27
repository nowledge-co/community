# Nowledge Mem for Codex

You have access to the user's knowledge through the installed plugin skills, the `nmem` CLI, and the Nowledge Mem MCP server when Codex exposes it in this session.

If this session exposes Nowledge Mem MCP tools, prefer them for retrieval and memory writes. Use the plugin skills and direct `nmem` commands for Codex-specific guidance, status checks, real transcript save, and CLI fallback.

## Operating Model

This Codex package is hybrid-aware, but still not hook-driven.

- Best modern setup: Codex plugin with bundled Nowledge Mem MCP.
- Reliable bootstrap: read Working Memory once near session start.
- Stronger retrieval and memory updates: use Nowledge Mem MCP tools when available.
- Explicit only: save the real Codex thread only when the user asks.

Do not stop at the Working Memory briefing if the task clearly resumes prior work.

## Working Memory

At session start, load the user's current context:

Prefer the Nowledge Mem MCP `read_working_memory` tool when it is available in this session.

Otherwise use:

```bash
nmem --json wm read
```

If it returns `exists: false`, mention there's no briefing yet and continue.

If this runtime already knows a project or agent lane, add `--space "<space name>"`.

If the task is a continuation, review, regression, release, integration, or "why did this change?" style task, immediately follow the briefing with one targeted memory or thread search.

## Search

Search when the task connects to prior work, the user asks about a past decision, or context from before would make the answer better.

In engineering repos, assume search is usually warranted for:
- regression investigation
- release prep
- review follow-up
- integration behavior drift
- docs or changelog alignment
- repeated subsystem work

Prefer Nowledge Mem MCP retrieval tools when they are available in this session:

- `memory_search` for durable knowledge
- `thread_search` for prior conversation lookup
- `thread_fetch_messages` for progressive thread inspection

Otherwise use:

```bash
nmem --json m search "query"
```

If the runtime already has an ambient lane, add `--space "<space name>"` to Working Memory, memory search, thread search, and save commands.

Use `--mode deep` when the first pass is weak or the need is conceptual.

For past conversations specifically:

```bash
nmem --json t search "query" --limit 5
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

## Distill

Save proactively when the conversation produces a decision, procedure, learning, or important context. Don't wait to be asked.

Prefer `memory_add` and `memory_update` through the Nowledge Mem MCP server when they are available in this session.

Otherwise use:

```bash
nmem --json m add "content" -t "Title" --unit-type decision -l "label" -s codex -i 0.8
```

Search first to avoid duplicates. If a memory already captures the same concept, update it:

```bash
nmem --json m update <memory_id> -c "updated content"
```

Unit types: `fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`

One strong memory is better than three weak ones.

At the end of substantial tasks, explicitly check whether one durable memory should be added or updated. Do not silently skip that review.

## Save Thread

Only when the user asks. This saves the real Codex transcript, not a reconstruction:

```bash
nmem --json t save --from codex -p . -s "Brief summary"
```

The summary adds searchable metadata; the full conversation is preserved.

## Remote

If Nowledge Mem is on a remote machine, configure the local client once:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
```

Use `NMEM_API_URL` / `NMEM_API_KEY` only for temporary overrides.
