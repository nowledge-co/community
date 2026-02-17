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

## Tool Surface (6 tools)

OpenClaw memory-slot compat:
- `memory_search` — required for system prompt "Memory Recall" section
- `memory_get` — required for memory slot contract

Nowledge Mem native (differentiators):
- `nowledge_mem_save` — structured capture with unit_type
- `nowledge_mem_context` — Working Memory daily briefing
- `nowledge_mem_connections` — knowledge graph exploration + source provenance (graph API)
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

## Known Gaps (from live testing)

1. **Temporal navigation** — users want "what was I working on last Tuesday?". Currently, include date context in `memory_search` query as a workaround. A proper `/agent/feed/events` date-range query tool would solve this fully.
2. **Cross-memory synthesis** — solved by `nowledge_mem_connections` but users don't always know to use it. Tool description and recall hook guidance updated to make this explicit.
3. **Source provenance** — available via `nowledge_mem_connections` SOURCED_FROM edges. Also addressed by description update.

## Recommended Next Improvements

1. Add `nmem graph neighbors` CLI command to avoid API-only dependency in `connections`.
2. Add a `nowledge_mem_timeline` tool wrapping `/agent/feed/events?date_from=...&date_to=...` for temporal queries.
3. Add `show/update` tools for individual memories (read + edit flow).
4. Add interactive `setup` CLI wizard for first-time configuration.
5. Add `wipe` CLI command with confirmation.
