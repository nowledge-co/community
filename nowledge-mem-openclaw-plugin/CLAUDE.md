# CLAUDE.md - Nowledge Mem OpenClaw Plugin

Continuation guide for `community/nowledge-mem-openclaw-plugin`.

## Scope

- Plugin target: OpenClaw plugin runtime (memory slot provider)
- Runtime: JS modules under `src/`, no TS build pipeline
- Memory backend: local `nmem` CLI (fallback `uvx --from nmem-cli nmem`)
- Graph API: local Nowledge Mem API (default `http://127.0.0.1:14242`)

## Design Philosophy

This plugin reflects Nowledge Mem's genuine strengths from the v0.6 architecture:

1. **Knowledge graph** — EVOLVES chains, entity relationships, memory connections
2. **Source provenance** — Library ingests docs/URLs, SOURCED_FROM edges trace knowledge origin
3. **Structured types** — 8 unit types (fact, preference, decision, etc.)
4. **Working Memory** — daily evolving briefing, not static profile
5. **Cross-AI continuity** — "Your AI tools forget. We remember. Everywhere."
6. **Hybrid search** — BM25 + semantic, not vector-only

## Files That Matter

- `src/index.js`: plugin registration (tools/hooks/commands/cli)
- `src/client.js`: nmem CLI resolution + API wrappers
- `src/config.js`: strict config parsing
- `src/hooks/recall.js`: before_agent_start context injection
- `src/hooks/capture.js`: append-first thread capture + quality-gated memory notes
- `src/tools/memory-search.js`: OpenClaw compat `memory_search`
- `src/tools/memory-get.js`: OpenClaw compat `memory_get`
- `src/tools/save.js`: structured knowledge capture with unit_type
- `src/tools/context.js`: Working Memory daily briefing
- `src/tools/connections.js`: knowledge graph exploration
- `src/tools/forget.js`: memory deletion
- `openclaw.plugin.json`: manifest + config schema + UI hints

## Tool Surface (7 tools)

OpenClaw memory-slot compat:
- `memory_search` — multi-signal search: embedding + BM25 + labels + graph + decay
- `memory_get` — required for memory slot contract

Nowledge Mem native (differentiators):
- `nowledge_mem_save` — structured capture with unit_type
- `nowledge_mem_context` — Working Memory daily briefing (read-only from plugin side)
- `nowledge_mem_connections` — knowledge graph exploration + source provenance (graph API)
- `nowledge_mem_timeline` — temporal feed browser (wraps GET /agent/feed/events, last_n_days param)
- `nowledge_mem_forget` — delete memory (user agency)

## Hook Surface

- `before_agent_start` — auto recall (Working Memory + search)
- `agent_end` — quality-gated memory note + thread append
- `after_compaction` — thread append
- `before_reset` — thread append

## Slash Commands

- `/remember` — quick save
- `/recall` — quick search
- `/forget` — quick delete

## Config Keys (authoritative)

- `autoRecall` (boolean, default `true`)
- `autoCapture` (boolean, default `false`)
- `maxRecallResults` (number, clamp 1-20, default `5`)

## Capture Quality Gate

Multi-layer filter (in `hooks/capture.js`):
1. Skip slash commands and short content
2. Skip questions (trailing `?`, interrogative starters)
3. Skip prompt-injection payloads
4. Skip injected context and system-generated XML
5. Require memory-trigger pattern (preference, decision, fact, entity)

## Local Smoke Commands

```bash
node --check src/index.js
node --check src/client.js
node --check src/tools/connections.js
node --check src/tools/save.js
nmem --version
nmem --json m search "test" -n 3
```

## Non-Goals / Avoid

- Do not add `nowledge_mem_search` — `memory_search` covers search. One tool.
- Do not add `containerTag`-style label wrappers — our labels are implicit graph properties.
- Do not reintroduce `serverUrl` config — plugin uses CLI + local API.
- Do not add cloud dependencies for core path.
- Do not accept unknown config keys (strict parser).

## API Reference (for tool implementors)

- **Feed events**: `GET /agent/feed/events?last_n_days=N&limit=100&event_type=...`
  - `last_n_days` (int, 1-365, default 365): window from today back
  - `event_type` (string, optional): filter to one type
  - Returns: `{ events: [...] }` with `event_type`, `title`, `description`, `created_at`
  - Storage: time-partitioned JSONL at `builtin_agents/events/YYYY/MM/YYYY-MM-DD.jsonl`

- **Search (bi-temporal)**: `GET /memories/search?q=...&event_date_from=YYYY&event_date_to=YYYY-MM-DD&recorded_date_from=YYYY-MM-DD&recorded_date_to=YYYY-MM-DD`
  - `event_date_from/to`: when the fact/event happened (YYYY, YYYY-MM, YYYY-MM-DD)
  - `recorded_date_from/to`: when the memory was saved to Nowledge Mem
  - Plugin: `memory_search` passes these via `client.searchTemporal()` (API-direct, not CLI)
  - CLI: `nmem m search "q" --event-from YYYY --event-to YYYY-MM-DD --recorded-from YYYY-MM-DD --recorded-to YYYY-MM-DD`
    (needs CLI rebuild to take effect)

- **Working Memory**: `GET /agent/working-memory?date=YYYY-MM-DD` (read, date optional for archive)
  - `PUT /agent/working-memory` body `{ content: string }` — **full overwrite only**, no line-based edit
  - CLI: `nmem wm read`, `nmem wm edit -m "..."`, `nmem wm history`
  - Plugin exposes read-only (`nowledge_mem_context`). Write is Knowledge Agent's domain.

- **Graph expand**: `GET /graph/expand/{node_id}?depth=1&limit=15`
  - Returns: `{ neighbors: [...], edges: [...] }`
  - Node types in response: Memory, Source, Entity

## Known Gaps (from live testing)

1. **Temporal navigation** — SOLVED by `nowledge_mem_timeline` (wraps `/agent/feed/events`).
   Remaining gap: no `date_from`/`date_to` params on the API, only `last_n_days`. Exact date queries ("last Tuesday") require client-side filtering.
2. **Cross-memory synthesis** — SOLVED via `nowledge_mem_connections`. Tool descriptions updated.
3. **Source provenance** — SOLVED via `nowledge_mem_connections` SOURCED_FROM edges.
4. **WM line-based edit** — NOT available. API is full-overwrite only. Backend change needed for section-level replace. Noted for future backend work.

## Recommended Next Improvements

1. Add `date_from`/`date_to` query params to backend `/agent/feed/events` for exact date filtering.
2. Add line-based WM section edit endpoint to backend (replace specific `## Section` content).
3. Add `nmem graph neighbors` CLI command to avoid API-only dependency in `connections`.
4. Add `show/update` tools for individual memories (read + edit flow).
5. Add interactive `setup` CLI wizard for first-time configuration.
