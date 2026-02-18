# Changelog

All notable changes to the Nowledge Mem OpenClaw plugin will be documented in this file.

## [0.2.7] - 2026-02-18

### Added — Gap closures: date range, EVOLVES CLI, WM section edit

**Feed date range filtering**

- `nowledge_mem_timeline` now accepts `date_from` and `date_to` (YYYY-MM-DD) for exact temporal queries ("what was I doing last Tuesday?").
- `client.feedEvents()` passes `--from`/`--to` to `nmem f`; falls back to API `?date_from=&date_to=` params.
- Backend `GET /agent/feed/events` now accepts `date_from` / `date_to` query params alongside `last_n_days`.
- CLI: `nmem f --from 2026-02-17 --to 2026-02-17`

**EVOLVES version chain via CLI**

- `nmem g evolves <id>` — new CLI command showing the full EVOLVES chain for a memory (replaces/enriches/confirms/challenges relations).
- `client.graphEvolves()` — new client method using `nmem g evolves`; falls back to `GET /agent/evolves?memory_id=<id>`.
- `connections.js` now uses `client.graphEvolves()` instead of a raw API call. "Knowledge evolution" section now correctly shows direction (→ newer / ← older) relative to the queried memory.
- Backend `GET /agent/evolves` now accepts `memory_id` query param to filter edges for a specific memory.

**Working Memory section-level edit**

- `nmem wm patch --heading "## Notes" --content/--append` — new CLI subcommand. Does client-side read-modify-write: reads WM, patches just the target section, writes the full doc back.
- `client.patchWorkingMemory(heading, { content, append })` — new client method.
- `nowledge_mem_context` now supports optional `patch_section` + `patch_content`/`patch_append` parameters. An agent can now update one section of Working Memory without destroying the rest.
- Includes a JS `patchWmSection()` helper in `client.js` for the API fallback path (for CLI versions that predate `wm patch`).

## [0.2.6] - 2026-02-18

### Added — Rich save: labels, event_start, temporal_context, unit_type fixed

## [0.2.5] - 2026-02-18

### Added — Remote mode configuration

- `apiUrl` config option: set to your remote server URL to use Nowledge Mem across devices or in a team. Leave empty for local mode (default: `http://127.0.0.1:14242`).
- `apiKey` config option: API key for remote access. Marked `"secret": true` in uiHints so OpenClaw can mask it in the UI. **Never logged, never passed as a CLI argument** — injected as `NMEM_API_KEY` env var into child processes only.
- `NowledgeMemClient` now accepts `{ apiUrl, apiKey }` credentials at construction time. Both config values and `NMEM_API_URL` / `NMEM_API_KEY` env vars are supported; plugin config wins over env vars.
- Initialization log now shows `mode=remote → https://...` vs `mode=local` (key never appears in logs).
- `_spawnEnv()` helper: builds per-spawn env with credentials injected; `_apiUrlArgs()` adds `--api-url` flag only when not local.

## [0.2.4] - 2026-02-18

### Changed — CLI-first architecture

All operations now go through the `nmem` CLI instead of direct API calls.
This is a structural alignment that makes every feature work in remote mode
(`NMEM_API_URL` + `NMEM_API_KEY`) without any plugin changes.

- `client.graphExpand()` — uses `nmem g expand <id>`; falls back to API on older CLI
- `client.feedEvents()` — uses `nmem f`; falls back to API on older CLI
- `client.search()` — CLI now returns `relevance_reason`, `importance`, `labels`,
  temporal fields natively; `searchRich()` is now an alias for `search()`
- `client.searchTemporal()` — uses `nmem m search --event-from/--recorded-from`
  CLI args; falls back to API if CLI is pre-bi-temporal-update
- `client._normalizeMemory()` — canonical memory shape shared across all search paths
- Removed `client.apiJson()` usage in `connections.js` and `timeline.js`
- `connections.js`: `client.apiJson()` retained only for the `/agent/evolves` chain
  (no CLI command for this yet — tracked as future improvement)

## [0.2.3] - 2026-02-18

### Changed — Graph Transparency & Scoring Visibility

- `nowledge_mem_connections`: completely rewritten output format
  - Edges are now JOIN-ed to their target nodes — each connection shows its relationship type and strength
  - Sections organized by edge type: "Synthesized from N source memories" (CRYSTALLIZED_FROM), "Knowledge evolution" (EVOLVES), "Sourced from document" (SOURCED_FROM), "Entities mentioned" (MENTIONS)
  - EVOLVES sub-relations are labeled: supersedes, enriches, confirms, challenges
  - Each connected memory includes its `id` for direct follow-up with `memory_get` or `nowledge_mem_connections`
- `memory_search`: now always uses API path (`searchRich`) — returns `matchedVia` with scoring breakdown
  - e.g. `"matchedVia": "Text Match (100%) + Semantic Match (69%) | decay[imp:high]"`
  - Also returns `importance` per result
  - Response `mode` field updated to `"multi-signal"` to reflect actual behavior
- `nowledge_mem_timeline`: timeline entries now include `(id: <memoryId>)` hint for events with linked memories — enables immediate chaining to `nowledge_mem_connections`
- `nowledge_mem_timeline`: `event_type` filter values documented in tool description for model discoverability
- Auto-recall hook: uses `searchRich` instead of CLI search — shows scoring breakdown in recalled context

### Added

- `client.searchRich()` — convenience wrapper for `searchTemporal` without temporal filters; always returns `relevanceReason`

## [0.2.2] - 2026-02-18

### Added

- `memory_search` now supports bi-temporal filtering:
  - `event_date_from` / `event_date_to` — when the fact/event happened (YYYY, YYYY-MM, YYYY-MM-DD)
  - `recorded_date_from` / `recorded_date_to` — when the memory was saved to Nowledge Mem
  - Uses API-direct path (`client.searchTemporal`) so it works regardless of installed CLI version
  - Results include `eventStart`, `eventEnd`, `temporalContext` when available
- `client.searchTemporal()` — new method wrapping `/memories/search` bi-temporal API directly

## [0.2.1] - 2026-02-18

### Added

- `nowledge_mem_timeline` tool: temporal feed browser wrapping `/agent/feed/events`. Answers "what was I working on last week?" with a day-grouped activity timeline. Supports `last_n_days`, `event_type`, and `tier1_only` filters.
- `memory_search` description now surfaces the full scoring pipeline (embedding + BM25 + labels + graph + decay)
- Recall hook updated: explicit tool routing for temporal queries (`nowledge_mem_timeline`) vs topic queries (`memory_search`/`nowledge_mem_connections`)

## [0.2.0] - 2026-02-18

### Changed — Tool Set Redesign

Redesigned from first principles around Nowledge Mem's v0.6 architecture.
This version reflects our genuine strengths: knowledge graph, structured types,
Working Memory, and cross-AI continuity.

### Added

- `nowledge_mem_save` tool: structured knowledge capture with `unit_type` parameter (fact, preference, decision, plan, procedure, learning, context, event) — replaces generic `nowledge_mem_store`
- `nowledge_mem_context` tool: read today's Working Memory daily briefing — replaces `nowledge_mem_working_memory` with clearer naming
- `nowledge_mem_connections` tool: explore knowledge graph around a topic — returns connected memories, EVOLVES chains, related entities, and Source document provenance (SOURCED_FROM edges from Library). This is our graph-native differentiator.
- `nowledge_mem_forget` tool: delete memories by ID or search query with confirmation flow
- `/forget` slash command: quick memory deletion from chat
- Capture quality gate: prompt injection detection, question filtering, memory-trigger pattern matching
- Recall context now includes tool guidance for Nowledge Mem native tools

### Removed

- `nowledge_mem_search` tool: redundant with `memory_search`. One search tool, done right.
- `nowledge_mem_store` tool: replaced by `nowledge_mem_save` with richer `unit_type` model
- `nowledge_mem_working_memory` tool: replaced by `nowledge_mem_context`

### Fixed

- Capture hook no longer saves questions or prompt-injection payloads as memory notes
- Recall context properly escapes memory content for prompt safety

## [0.1.5] - 2026-02-17

### Fixed

- Aligned plugin ids with OpenClaw installer id derivation so `openclaw plugins install --link` and npm installs work without config validation failures:
  - package id (`@nowledge/openclaw-nowledge-mem`) -> plugin id (`openclaw-nowledge-mem`)
  - manifest/export ids now match installer-derived id

### Changed

- Updated docs/examples to use:
  - `plugins.slots.memory = "openclaw-nowledge-mem"`
  - `plugins.entries.openclaw-nowledge-mem`

## [0.1.4] - 2026-02-17

### Added

- OpenClaw memory-compatible tool aliases:
  - `memory_search` (structured recall output with source paths)
  - `memory_get` (fetch by `nowledgemem://memory/<id>` or raw memory ID)
- `after_compaction` capture hook to preserve thread continuity across compaction cycles

### Changed

- Auto-capture is now append-first with deterministic thread IDs:
  - Attempts `append` with deduplication
  - Falls back to `create` on first write
- Added CLI/API fallback in client for mixed nmem versions (append/create with explicit thread IDs)
- Added retry-safe append `idempotency_key` propagation for transcript batches
- Updated docs to require `plugins.slots.memory = "nowledge-mem"` for full memory-slot replacement behavior

## [0.1.3] - 2026-02-17

### Changed

- Replaced `autoCapture` no-op with real capture pipeline:
  - `agent_end`: stores high-signal user memory via `nmem m add`
  - `before_reset`: snapshots recent session messages via `nmem t create`
- Added resilient session snapshot fallback by reading `before_reset.sessionFile` JSONL when hook payload messages are not present

## [0.1.2] - 2026-02-17

### Fixed

- Aligned tool handler signature with OpenClaw runtime (`execute(toolCallId, params)`)
- Hardened `nmem` execution path to avoid shell interpolation/injection
- Updated package metadata to `openclaw.extensions` for plugin install/discovery compatibility
- Corrected manifest `uiHints` structure and `maxRecallResults` type (`integer`)
- Added prompt-safety escaping for recalled memory context
- Fixed store tool handling for `importance: 0`
- Updated docs for current OpenClaw install/config flow

### Changed

- `autoCapture` now logs a warning and skips capture because nmem-cli does not support OpenClaw thread/message persistence

## [0.1.1] - 2026-02-15

### Changed

- Removed unused `serverUrl` configuration from schema/docs (plugin is local `nmem` CLI based)
- Improved recall hook prompt to present injected context as central external memory
- Added UI hint details for `maxRecallResults`

## [0.1.0] - 2026-02-14

### Added

- **Tools**: 3 agent tools
  - `nowledge_mem_search` : semantic search across personal knowledge base
  - `nowledge_mem_store` : save insights, decisions, and findings
  - `nowledge_mem_working_memory` : read daily Working Memory briefing
- **Hooks**:
  - `before_agent_start` : auto-recall Working Memory + relevant memories
  - `agent_end` : auto-capture conversation thread
- **Slash commands**: `/remember`, `/recall`
- **CLI**: `openclaw nowledge-mem search`, `openclaw nowledge-mem status`
- **nmem CLI integration**: local-first, no API key required
- **Plain JavaScript** (ES modules): no build step, no TypeScript dependency
