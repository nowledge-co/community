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
4. **Working Memory** — daily evolving briefing; agents can patch sections without overwriting the whole document
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
- `nowledge_mem_context` — Working Memory daily briefing. Read-only by default; supports section-level patch via `patch_section` + `patch_content`/`patch_append` params (uses `nmem wm patch` client-side read-modify-write).
- `nowledge_mem_connections` — graph exploration. Edges JOIN-ed to nodes by type: CRYSTALLIZED_FROM (crystal → source memories), EVOLVES (with sub-relations: supersedes/enriches/confirms/challenges), SOURCED_FROM (document provenance), MENTIONS (entities). Each connection shows strength % and memoryId.
- `nowledge_mem_timeline` — activity feed via `nmem f`. Groups by day. `event_type` filter. Exact date range via `date_from`/`date_to` (YYYY-MM-DD). Entries include `(id: <memoryId>)` for chaining to connections.
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

All keys support **env var fallback** — critical for OpenClaw >= 2026.2.25 which may strip plugin config.

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `autoRecall` | boolean | `false` | `NMEM_AUTO_RECALL` | Inject context at session start |
| `autoCapture` | boolean | `false` | `NMEM_AUTO_CAPTURE` | Capture notes/threads at session end |
| `captureMinInterval` | integer 0–86400 | `300` | `NMEM_CAPTURE_MIN_INTERVAL` | Seconds between captures per thread |
| `maxRecallResults` | integer 1–20 | `5` | `NMEM_MAX_RECALL_RESULTS` | How many memories to recall |
| `apiUrl` | string | `""` | `NMEM_API_URL` | Remote server URL. Empty = local (127.0.0.1:14242) |
| `apiKey` | string | `""` | `NMEM_API_KEY` | API key. Never logged. |

**Priority**: pluginConfig > env var > default.

### Credential Handling Rules
- `apiKey` → ONLY via child process env (`NMEM_API_KEY`). Never CLI arg, never logged.
- `apiUrl` → passed as `--api-url` flag to CLI (not a secret).
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

1. **Feed API `date_from`/`date_to`** — supported. Backend filters events by YYYY-MM-DD range. CLI: `nmem f --from/--to`. Plugin: `nowledge_mem_timeline` accepts `date_from`/`date_to`.
2. **Working Memory section edit** — supported. `nmem wm patch --heading "## X" --content/--append` does client-side read-modify-write. Plugin: `nowledge_mem_context` accepts `patch_section` + `patch_content`/`patch_append`.
3. **EVOLVES chain CLI** — supported. `nmem g evolves <id>` calls `/agent/evolves?memory_id=<id>`. Plugin: `nowledge_mem_connections` uses `client.graphEvolves()`.
4. **`unit_type` requires rebuilt backend** — `MemoryCreateRequest` includes `unit_type` (fixed). Restart backend after rebuild.
5. **Working Memory full-overwrite only via API** — the API (`PUT /agent/working-memory`) still takes full content. The section-level patch is implemented purely client-side. This is acceptable; the Knowledge Agent regenerates WM each morning anyway.

## Non-Goals

- Do NOT add `nowledge_mem_search` — `memory_search` covers it.
- Do NOT expose full WM overwrite from agents — section-level patch is the right granularity.
- Do NOT add cloud dependencies to the core path.
- Do NOT accept unknown config keys (strict parser in `config.js`).
