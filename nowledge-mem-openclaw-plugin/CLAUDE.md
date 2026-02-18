# CLAUDE.md — Nowledge Mem OpenClaw Plugin

Continuation guide for `community/nowledge-mem-openclaw-plugin`.

## Scope

- Plugin target: OpenClaw plugin runtime (memory slot provider)
- Runtime: JS ESM modules under `src/`, no TS build pipeline
- Memory backend: `nmem` CLI (fallback: `uvx --from nmem-cli nmem`)
- Architecture: **CLI-first** — all operations go through the nmem CLI, not direct API calls
- Remote mode: set `NMEM_API_URL` + `NMEM_API_KEY` env vars or plugin config `apiUrl` + `apiKey`

## Design Philosophy

Reflects Nowledge Mem's genuine v0.6 strengths:

1. **Knowledge graph** — EVOLVES chains, entity relationships, typed memory connections
2. **Source provenance** — Library ingests docs/URLs; `SOURCED_FROM` edges trace knowledge origin
3. **Structured types** — 8 unit types: `fact | preference | decision | plan | procedure | learning | context | event`
4. **Working Memory** — daily evolving briefing (read-only from plugin; updated by Knowledge Agent)
5. **Cross-AI continuity** — "Your AI tools forget. We remember. Everywhere."
6. **Hybrid search** — BM25 + semantic + graph + decay, not vector-only
7. **Transparent scoring** — `relevance_reason` in every search result

## Files That Matter

```
src/
  index.js          — plugin registration (tools, hooks, commands, CLI)
  client.js         — CLI wrapper with API fallback; credential handling
  config.js         — strict config parsing (apiUrl, apiKey, autoRecall, etc.)
  hooks/
    recall.js       — before_agent_start: inject Working Memory + recalled memories
    capture.js      — quality-gated memory note + thread append
  tools/
    memory-search.js    — OpenClaw compat; multi-signal; bi-temporal; relevance_reason
    memory-get.js       — OpenClaw compat; supports MEMORY.md alias
    save.js             — structured capture: unit_type, labels, temporal, importance
    context.js          — Working Memory daily briefing (read-only)
    connections.js      — graph exploration: edge types, relationship strength, provenance
    timeline.js         — activity feed: daily grouping, event_type filter, memoryId hints
    forget.js           — memory deletion by ID or search
openclaw.plugin.json — manifest + config schema (version, uiHints, configSchema)
```

## Tool Surface (7 tools)

### OpenClaw Memory Slot (required for system prompt activation)
- `memory_search` — multi-signal: BM25 + embedding + label + graph + decay. Returns `matchedVia` ("Text Match 100% + Semantic 69%"), `importance`, bi-temporal filters (`event_date_from/to`, `recorded_date_from/to`). Mode: `"multi-signal"`.
- `memory_get` — retrieve by `nowledgemem://memory/<id>` path or bare ID. `MEMORY.md` → Working Memory.

### Nowledge Mem Native (differentiators)
- `nowledge_mem_save` — structured capture: `unit_type`, `labels[]`, `event_start`, `event_end`, `temporal_context`, `importance`. All fields wired to CLI and API.
- `nowledge_mem_context` — Working Memory daily briefing. Read-only from plugin; write is Knowledge Agent domain.
- `nowledge_mem_connections` — graph exploration. Edges JOIN-ed to nodes by type: CRYSTALLIZED_FROM (crystal → source memories), EVOLVES (with sub-relations: supersedes/enriches/confirms/challenges), SOURCED_FROM (document provenance), MENTIONS (entities). Each connection shows strength % and memoryId.
- `nowledge_mem_timeline` — activity feed via `nmem f`. Groups by day. `event_type` filter (memory_created, crystal_created, source_ingested, etc.). Entries include `(id: <memoryId>)` for chaining to connections.
- `nowledge_mem_forget` — delete by ID or fuzzy query.

## Hook Surface

- `before_agent_start` — auto-recall: Working Memory + `searchRich()` with `relevanceReason` in context
- `agent_end` — quality-gated memory note + thread append (requires `autoCapture: true`)
- `after_compaction` — thread append
- `before_reset` — thread append

## Slash Commands

- `/remember` — quick save
- `/recall` — quick search
- `/forget` — quick delete

## Config Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoRecall` | boolean | `true` | Inject context at session start |
| `autoCapture` | boolean | `false` | Capture notes/threads at session end |
| `maxRecallResults` | integer 1–20 | `5` | How many memories to recall |
| `apiUrl` | string | `""` | Remote server URL. Empty = local (127.0.0.1:14242) |
| `apiKey` | string | `""` | API key. Injected as `NMEM_API_KEY` env var only. Never logged. |

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
| `nmem --json f [--days] [--type] [--all]` | `client.feedEvents()` | Activity feed |
| `nmem --json wm read` | `client.readWorkingMemory()` | Working Memory |
| `nmem --json m delete <id>` | `client.execJson()` in forget.js | Delete |

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
nmem f --days 1
nmem f --type crystal_created

# Remote mode
NMEM_API_URL=https://your-server NMEM_API_KEY=key nmem status
```

## Known Gaps / Accepted Limitations

1. **Feed API has no `date_from`/`date_to`** — only `last_n_days`. Exact date queries ("last Tuesday") require client-side filtering. Tracked for backend.
2. **Working Memory edit is full-overwrite only** — no section-level replace via API. Knowledge Agent domain.
3. **EVOLVES chain** in `connections.js` still calls `/agent/evolves` directly (no `nmem g evolves` command yet).
4. **`unit_type` requires rebuilt backend** — `MemoryCreateRequest` now includes `unit_type` (fixed in this branch). Restart backend after rebuild.

## Non-Goals

- Do NOT add `nowledge_mem_search` — `memory_search` covers it.
- Do NOT expose WM write — it's Knowledge Agent domain.
- Do NOT add cloud dependencies to the core path.
- Do NOT accept unknown config keys (strict parser in `config.js`).
