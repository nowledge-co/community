# CLAUDE.md - Nowledge Mem OpenClaw Plugin

Continuation guide for `community/nowledge-mem-openclaw-plugin`.

## Scope

- Plugin target: OpenClaw plugin runtime (memory slot provider)
- Runtime: JS ESM modules under `src/`, no TS build pipeline
- Memory backend: `nmem` CLI (fallback: `uvx --from nmem-cli nmem`)
- Architecture: **CLI-first** - all operations go through the nmem CLI, not direct API calls
- Remote mode: set `NMEM_API_URL` + `NMEM_API_KEY` env vars or config file `apiUrl` + `apiKey`

## Design Philosophy

Reflects Nowledge Mem's genuine v0.6 strengths:

1. **Knowledge graph** - EVOLVES chains, entity relationships, typed memory connections
2. **Source provenance** - Library ingests docs/URLs; `SOURCED_FROM` edges trace knowledge origin
3. **Structured types** - 8 unit types: `fact | preference | decision | plan | procedure | learning | context | event`
4. **Working Memory** - daily evolving briefing; agents can patch sections without overwriting the whole document
5. **Cross-AI continuity** - "Your AI tools forget. We remember. Everywhere."
6. **Hybrid search** - BM25 + semantic + graph + decay, not vector-only
7. **Transparent scoring** - `relevance_reason` in every search result

## Files That Matter

```
src/
  index.js          - plugin registration (tools, hooks, commands, CLI)
  client.js         - CLI wrapper with API fallback; credential handling
  config.js         - config cascade: pluginConfig > ~/.nowledge-mem/openclaw.json > env vars > defaults
  hooks/
    behavioral.js   - always-on behavioral guidance (~50 tokens/turn)
    recall.js       - before_prompt_build: inject Working Memory + recalled memories
    capture.js      - thread capture + LLM triage/distillation at session lifecycle events
  tools/
    memory-search.js    - OpenClaw compat; multi-signal; bi-temporal; relevance_reason; sourceThreadId
    memory-get.js       - OpenClaw compat; supports MEMORY.md alias; sourceThreadId
    save.js             - structured capture: unit_type, labels, temporal, importance; pre-save dedup check
    context.js          - Working Memory daily briefing (read + section-level patch)
    connections.js      - graph exploration: edge types, relationship strength, provenance
    timeline.js         - activity feed: daily grouping, event_type filter, memoryId hints
    forget.js           - memory deletion by ID or search
    thread-search.js    - search past conversations by keyword
    thread-fetch.js     - fetch full messages from a thread with pagination
openclaw.plugin.json - manifest + config schema (version, uiHints, configSchema)
~/.nowledge-mem/openclaw.json - user config file (auto-created on first run)
```

## Tool Surface (10 tools)

### OpenClaw Memory Slot (required for system prompt activation)
- `memory_search` - multi-signal: BM25 + embedding + label + graph + decay. Returns `matchedVia` ("Text Match 100% + Semantic 69%"), `importance`, bi-temporal filters (`event_date_from/to`, `recorded_date_from/to`). Also returns `relatedThreads` (past conversation snippets matching the query) and `sourceThreadId` (link to source conversation). Mode: `"multi-signal"`.
- `memory_get` - retrieve by `nowledgemem://memory/<id>` path or bare ID. `MEMORY.md` → Working Memory. Returns `sourceThreadId` when available.

### Nowledge Mem Native (differentiators)
- `nowledge_mem_save` - structured capture: `unit_type`, `labels[]`, `event_start`, `event_end`, `temporal_context`, `importance`. All fields wired to CLI and API.
- `nowledge_mem_context` - Working Memory daily briefing. Read-only by default; supports section-level patch via `patch_section` + `patch_content`/`patch_append` params (uses `nmem wm patch` client-side read-modify-write).
- `nowledge_mem_connections` - graph exploration. Edges JOIN-ed to nodes by type: CRYSTALLIZED_FROM (crystal → source memories), EVOLVES (with sub-relations: supersedes/enriches/confirms/challenges), SOURCED_FROM (document provenance), MENTIONS (entities). Each connection shows strength % and memoryId.
- `nowledge_mem_timeline` - activity feed via `nmem f`. Groups by day. `event_type` filter. Exact date range via `date_from`/`date_to` (YYYY-MM-DD). Entries include `(id: <memoryId>)` for chaining to connections.
- `nowledge_mem_forget` - delete by ID or fuzzy query.

### Thread Tools (progressive conversation retrieval)
- `nowledge_mem_thread_search` - search past conversations by keyword. Returns threads with matched message snippets, relevance scores, and message counts. Supports `source` filter.
- `nowledge_mem_thread_fetch` - fetch full messages from a specific thread. Supports pagination via `offset` + `limit` for progressive retrieval of long conversations.

### Diagnostics
- `nowledge_mem_status` - show effective config (mode, apiUrl, apiKey set, sessionContext, sessionDigest, etc.), backend connectivity, and version. No parameters.

## Hook Surface

- `before_prompt_build` (always-on) - behavioral guidance: brief note telling agent to save/search proactively. Adjusts when sessionContext is on to avoid redundant searches.
- `before_prompt_build` (sessionContext) - session context: Working Memory + `searchRich()` with `relevanceReason` in context
- `agent_end` - thread capture + LLM triage/distillation (requires `sessionDigest: true`)
- `after_compaction` - thread append
- `before_reset` - thread append

## Slash Commands

- `/remember` - quick save
- `/recall` - quick search
- `/forget` - quick delete

## Config Keys

Config file at `~/.nowledge-mem/openclaw.json` (auto-created on first run). Also supports env vars and pluginConfig.

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `sessionContext` | boolean | `false` | `NMEM_SESSION_CONTEXT` | Inject Working Memory + relevant memories at prompt time |
| `sessionDigest` | boolean | `true` | `NMEM_SESSION_DIGEST` | Thread capture + LLM distillation at session end |
| `digestMinInterval` | integer 0-86400 | `300` | `NMEM_DIGEST_MIN_INTERVAL` | Minimum seconds between session digests |
| `maxContextResults` | integer 1-20 | `5` | `NMEM_MAX_CONTEXT_RESULTS` | How many memories to inject at prompt time |
| `apiUrl` | string | `""` | `NMEM_API_URL` | Remote server URL. Empty = local (127.0.0.1:14242) |
| `apiKey` | string | `""` | `NMEM_API_KEY` | API key. Never logged. |

**Priority**: pluginConfig > config file > env var > default.

Legacy aliases accepted silently in all sources for backward compat:
`autoRecall`→`sessionContext`, `autoCapture`→`sessionDigest`, `captureMinInterval`→`digestMinInterval`, `maxRecallResults`→`maxContextResults`.

### Credential Handling Rules
- `apiKey` → ONLY via child process env (`NMEM_API_KEY`). Never CLI arg, never logged.
- `apiUrl` → passed as `--api-url` flag to CLI (not a secret).
- Config values win over environment variables.
- `_spawnEnv()` builds per-spawn env; `_apiUrlArgs()` adds `--api-url` when non-default.

## CLI Surface (nmem commands used by plugin)

| Command | Plugin method | Notes |
|---------|--------------|-------|
| `nmem --json m search <q>` | `client.search()` | Rich: relevance_reason, importance, labels, temporal |
| `nmem --json m search <q> --event-from/--event-to/--recorded-from/--recorded-to` | `client.searchTemporal()` | Bi-temporal |
| `nmem --json m add <content> [--unit-type] [-l] [--event-start] [--when]` | `client.execJson()` in save.js | Full rich save |
| `nmem --json g expand <id>` | `client.graphExpand()` | Graph neighbors + edges |
| `nmem --json g evolves <id>` | `client.graphEvolves()` | EVOLVES version chain |
| `nmem --json f [--days] [--type] [--all] [--from DATE] [--to DATE]` | `client.feedEvents()` | Activity feed + date range |
| `nmem --json wm read` | `client.readWorkingMemory()` | Working Memory read |
| `nmem --json wm patch --heading "## S" --content/--append` | `client.patchWorkingMemory()` | Section-level WM update |
| `nmem --json m delete <id>` | `client.execJson()` in forget.js | Delete |
| `GET /threads/search?query=&limit=` | `client.searchThreads()` | Thread search enrichment (best-effort, API-only) |
| `nmem --json t search <q> --limit N` | `client.searchThreadsFull()` | Full thread search (CLI-first, API fallback) |
| `nmem --json t show <id> --limit N --offset O` | `client.fetchThread()` | Fetch thread messages with pagination |

All commands have API fallback for older CLI versions.

## Smoke Test

```bash
# Lint
npx biome check src/

# CLI
nmem --version
nmem --json m search "test" -n 3
nmem --json m add "test memory" --unit-type learning -l test
nmem g expand <id-from-above>
nmem g evolves <id-from-above>
nmem f --days 1
nmem f --type crystal_created
nmem f --from 2026-02-17 --to 2026-02-17
nmem wm patch --heading "## Notes" --append "New note from agent"

# Remote mode
NMEM_API_URL=https://your-server NMEM_API_KEY=key nmem status
```

## Known Gaps / Accepted Limitations

1. **Feed API `date_from`/`date_to`** - supported. Backend filters events by YYYY-MM-DD range. CLI: `nmem f --from/--to`. Plugin: `nowledge_mem_timeline` accepts `date_from`/`date_to`.
2. **Working Memory section edit** - supported. `nmem wm patch --heading "## X" --content/--append` does client-side read-modify-write. Plugin: `nowledge_mem_context` accepts `patch_section` + `patch_content`/`patch_append`.
3. **EVOLVES chain CLI** - supported. `nmem g evolves <id>` calls `/agent/evolves?memory_id=<id>`. Plugin: `nowledge_mem_connections` uses `client.graphEvolves()`.
4. **`unit_type` requires rebuilt backend** - `MemoryCreateRequest` includes `unit_type` (fixed). Restart backend after rebuild.
5. **Working Memory full-overwrite only via API** - the API (`PUT /agent/working-memory`) still takes full content. The section-level patch is implemented purely client-side. This is acceptable; the Knowledge Agent regenerates WM each morning anyway.

## Non-Goals

- Do NOT add `nowledge_mem_search` - `memory_search` covers it.
- Do NOT expose full WM overwrite from agents - section-level patch is the right granularity.
- Do NOT add cloud dependencies to the core path.
- Do NOT accept unknown config keys (strict parser in `config.js`).
