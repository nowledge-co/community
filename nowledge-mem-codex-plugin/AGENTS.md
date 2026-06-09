# Nowledge Mem for Codex

You have access to the user's knowledge through the installed plugin skills, the `nmem` CLI, and the Nowledge Mem MCP server when Codex exposes it in this session.

If this session exposes Nowledge Mem MCP tools, prefer them for retrieval and memory writes. Use the plugin skills and direct `nmem` commands for Codex-specific guidance, status checks, real transcript save, and CLI fallback.

## Operating Model

This Codex package is hybrid-aware and hook-assisted.

- Best modern setup: Codex plugin with bundled Nowledge Mem MCP.
- Automatic capture: the Codex Stop hook saves the real transcript through `nmem t save --from codex` after each turn.
- Current Codex: enable both `hooks = true` and `plugin_hooks = true`, then run `scripts/install_hooks.py` once after installing or updating the plugin. `plugin_hooks` lets Codex load the packaged Stop hook; the setup script keeps that hook enabled in `/hooks` and also keeps the host-level fallback for builds that still need `~/.codex/hooks.json`.
- Reliable bootstrap: read Context Bundle once when full identity/scope/rules matter; read Working Memory when only the daily briefing is needed.
- Stronger retrieval and memory updates: use Nowledge Mem MCP tools when available.
- Explicit fallback: if hook setup is missing or the user asks for a manual save, use the `save-thread` skill.

Do not stop at the startup context if the task clearly resumes prior work.

## Startup Context

At session start, load the user's current context.

Prefer the Nowledge Mem MCP `read_context_bundle` tool when identity, agent lane, space scope, or Rules could matter. It includes owner identity, resolved AI Identity, active scope, active rules, Working Memory, and KFS paths.

Otherwise use:

```bash
nmem --json context --source-app codex
```

If this runtime already knows a project or agent lane, add `--space "<space name>"`.

If `read_context_bundle` / `nmem context` is unavailable or the user only asks for the daily briefing, use `read_working_memory` or:

```bash
nmem --json wm read
```

If Working Memory returns `exists: false`, mention there's no briefing yet and continue.

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

If the runtime already has an ambient lane, add `--space "<space name>"` to Context Bundle, Working Memory, memory search, thread search, and save commands.

Use `--mode deep` when the first pass is weak or the need is conceptual.

## Knowledge Tree

When the task needs to browse across memories, threads, wiki pages, working memory, activities, sources, and artifacts as one shape, use the Knowledge Filesystem:

Prefer the MCP `mem_fs` tool when it is available. It accepts shell-shaped commands such as:

```text
capabilities
ls /
recall "session token strategy" --in /memories -k 5
find /memories --label decisions --since 2026-01-01
grep "JWT rotation" /memories
grep -E "JWT|token" /threads
cat /memories/by-id/<id>.memory.md
stat /wiki/entities/PostgreSQL--<id>.entity.md
```

Otherwise use the CLI fallback:

```bash
nmem fs ls /
nmem fs capabilities --json
nmem fs recall "session token strategy" --in /memories -k 5
nmem fs cat /memories/by-id/<id>.memory.md
```

Use `capabilities` before building adapters or checking whether a future feature has shipped. Use `recall` for fuzzy intent, `find` for metadata constraints, `grep` for exact strings, `grep -E` for explicit regex, `stat` before loading large bodies, and `cat` only after choosing a path. Treat returned paths as Mem identifiers, not OS filesystem paths. Mounting, source fragments, SQL/Cypher, replay, and tail are later phases.

For past conversations specifically:

```bash
nmem --json t search "query" --limit 5
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

## Distill

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Don't wait to be asked.

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

Normally the Stop hook saves the real Codex transcript automatically. Use this command only when the user asks for a manual save or when hook setup is unavailable:

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

If Codex also needs the MCP tools against remote Mem, generate a host-owned MCP config block with:

```bash
nmem config mcp show --host codex
```

Paste that into `~/.codex/config.toml`. Direct MCP clients do not read `~/.nowledge-mem/config.json` automatically.
If `codex mcp list` shows `Not logged in`, update `nmem`, make sure the desktop app or `nmem config client ...` has written the right URL/API key, then rerun `scripts/install_hooks.py` or paste the generated block manually. Do not use `codex mcp login nowledge-mem`; that command is for OAuth MCP servers.
