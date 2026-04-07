# CLAUDE.md - Nowledge Mem OpenClaw Plugin

Continuation guide for `community/nowledge-mem-openclaw-plugin`.

## Scope

- Plugin target: OpenClaw plugin runtime (memory slot + context engine)
- Runtime: JS ESM modules under `src/`, no TS build pipeline
- Memory backend: `nmem` CLI (fallback: `uvx --from nmem-cli nmem`)
- OpenClaw minimum: `2026.4.5` (`registerMemoryCorpusSupplement` for dreaming integration)
- Architecture: **CLI-first via OpenClaw runtime** - all CLI execution goes through `api.runtime.system.runCommandWithTimeout`, not direct `child_process`
- Context engine: registered via `api.registerContextEngine("nowledge-mem", factory)`. Activated when user sets `plugins.slots.contextEngine: "nowledge-mem"`. Falls back to hooks when CE is not active.
- Remote mode: `~/.nowledge-mem/config.json` (shared) or OpenClaw dashboard. Legacy `openclaw.json` still honored.

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
  index.js          - plugin registration (tools, hooks, CE, commands, CLI)
  context-engine.js - Context Engine factory: assemble, afterTurn, compact, subagent hooks
  ce-state.js       - shared { active } flag for CE/hook coordination
  client.js         - CLI wrapper with API fallback; async runtime command execution; credential handling
  spawn-env.js      - env-only credential injection for the nmem runner
  config.js         - config cascade: openclaw.json (legacy) > pluginConfig > config.json (credentials) > env > defaults
  corpus-supplement.js - MemoryCorpusSupplement for memory-core dreaming pipeline; search + get backed by nmem
  hooks/
    behavioral.js   - always-on behavioral guidance (~50 tokens/turn); no-ops when CE active
    recall.js       - before_prompt_build: inject Working Memory + recalled memories; no-ops when CE active
    capture.js      - thread capture + LLM triage/distillation; shared functions used by both hooks and CE
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
skills/
  memory-guide/
    SKILL.md            - agent behavioral skill: when/how to search, save, explore memory (auto-discovered by OpenClaw)
openclaw.plugin.json - manifest + config schema (version, uiHints, configSchema, skills)
~/.nowledge-mem/openclaw.json - legacy config file (still honored, deprecated in docs)
~/.nowledge-mem/config.json   - shared credentials (apiUrl/apiKey) read by all Nowledge Mem tools
```

## Corpus Supplement (Dreaming Integration)

When `corpusSupplement: true`, the plugin registers a `MemoryCorpusSupplement` via `api.registerMemoryCorpusSupplement()`. This makes Nowledge Mem's knowledge graph searchable through memory-core's recall pipeline, including its three-phase dreaming system (light, deep, REM).

### How it works

1. **Recall**: When memory-core's `memory_search` runs, it fans out to all registered corpus supplements. Our supplement calls `client.search()` and maps results to `MemoryCorpusSearchResult` format.
2. **Dreaming**: Recalled Nowledge Mem content accumulates frequency, relevance, and diversity scores in memory-core's short-term recall store. High-scoring content is promoted to `MEMORY.md` during deep-phase dreaming.
3. **Dedup**: When active, the recall hook and CE `assemble()` skip their own search-based recall (memories section only). Working Memory injection continues as before.

### When to enable

Enable when memory-core is the memory slot and you want cross-tool knowledge to participate in OpenClaw's native recall and dreaming. Most users have Nowledge Mem as the memory slot (default `false`).

### Config keys

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `corpusSupplement` | boolean | `false` | `NMEM_CORPUS_SUPPLEMENT` | Register as corpus supplement |
| `corpusMaxResults` | integer 1-20 | `5` | `NMEM_CORPUS_MAX_RESULTS` | Max results per search call |
| `corpusMinScore` | integer 0-100 | `0` | `NMEM_CORPUS_MIN_SCORE` | Min score filter (0 = include all) |

## Context Engine (CE) Architecture

The plugin registers both a **memory slot** (`kind: "memory"`) and a **context engine** (`api.registerContextEngine`). These are independent registrations:

- **Memory slot**: provides `memory_search` + `memory_get`, activates OpenClaw's "Memory Recall" system prompt section. Always active.
- **Context engine**: activated when user sets `plugins.slots.contextEngine: "nowledge-mem"`. Replaces hooks with richer CE lifecycle.

### CE vs Hooks (dual-path design)

A shared `ceState.active` flag (in `ce-state.js`) coordinates the two paths:

| Lifecycle | CE active | CE inactive (hooks) |
|-----------|-----------|---------------------|
| Behavioral guidance | `assemble()` → `systemPromptAddition` | `before_prompt_build` → `appendSystemContext` |
| Memory recall | `assemble()` → `systemPromptAddition` | `before_prompt_build` → `appendSystemContext` |
| Thread capture | `afterTurn()` (every turn) | `agent_end` / `after_compaction` / `before_reset` |
| Triage + distill | `afterTurn()` | `agent_end` only |
| Compaction | `compact()` with memory-aware instructions | None (OpenClaw legacy) |
| Subagent context | `prepareSubagentSpawn()` + `onSubagentEnded()` | None |
| Session init | `bootstrap()` pre-warms WM | None |

### Key design decisions

- **`ownsCompaction: false`**: we enhance compaction instructions with memory context, but delegate the actual compaction to OpenClaw's runtime via `delegateCompactionToRuntime()`.
- **Messages pass through unchanged**: `assemble()` returns the same messages it receives. We only add `systemPromptAddition`. We never own message selection.
- **Per-session state**: `_sessions` map (bounded at 100 entries) caches Working Memory and recalled memories per session. `_childContext` map caches subagent context.
- **Cache-friendly injection**: both CE (`systemPromptAddition`) and hooks (`appendSystemContext`) inject into system-prompt space. Never use `prependContext` (user-message space, breaks cache).

### Activation

```json
// openclaw.json
{
  "plugins": {
    "slots": {
      "memory": "openclaw-nowledge-mem",
      "contextEngine": "nowledge-mem"
    }
  }
}
```

When `contextEngine` points elsewhere (or is absent), hooks handle everything. No config change needed for existing users.

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
- `nowledge_mem_thread_fetch` - fetch messages from a specific thread. Start with a small page, then use `offset` + `limit` for progressive retrieval only when more context is needed.

### Diagnostics
- `nowledge_mem_status` - show plugin trust status, memory slot status, effective config (mode, apiUrl, apiKey set, sessionContext, sessionDigest, etc.), backend connectivity, and version. Checks `plugins.allow`: warns if set but plugin not included (loading blocked); shows tip if not set (plugin loads via `entries.enabled` but trust is implicit). Warns if the memory slot points to `memory-core` instead of `openclaw-nowledge-mem` (common after OpenClaw 3.22+ upgrade). No parameters.

## Skill Surface

- `skills/memory-guide/SKILL.md` - agent behavioral skill auto-discovered by OpenClaw via manifest `skills[]`. Teaches the agent when/how to search, save, explore connections, fetch threads, and use Working Memory. Read on-demand when the agent identifies a memory-related task.

## Hook Surface

- `before_prompt_build` (always-on) - directive behavioral guidance in system-prompt space: tells agent to search before answering questions about prior work/decisions/preferences, and to save decisions/learnings proactively. Explicitly notes semantic search (not file paths) to counter OpenClaw's hardcoded memory section. Adjusts when sessionContext is on to avoid redundant searches.
- `before_prompt_build` (sessionContext) - session context: Working Memory + `searchRich()` memories with `relevanceReason`. Note: does NOT inject thread snippets — threads are available via `memory_search` tool and `nowledge_mem_thread_fetch`.
- `agent_end` - thread capture + LLM triage/distillation (requires `sessionDigest: true`)
- `after_compaction` - thread append
- `before_reset` - thread append

## Slash Commands

- `/remember` - quick save
- `/recall` - quick search
- `/forget` - quick delete

## Config Keys

Plugin settings: OpenClaw dashboard (pluginConfig). Legacy `~/.nowledge-mem/openclaw.json` still honored.
Credentials (apiUrl/apiKey): also reads `~/.nowledge-mem/config.json` (shared with all Nowledge Mem tools).

| Key | Type | Default | Env Var | Description |
|-----|------|---------|---------|-------------|
| `sessionContext` | boolean | `false` | `NMEM_SESSION_CONTEXT` | Inject Working Memory + relevant memories at prompt time |
| `sessionDigest` | boolean | `true` | `NMEM_SESSION_DIGEST` | Thread capture + LLM distillation at session end |
| `digestMinInterval` | integer 0-86400 | `300` | `NMEM_DIGEST_MIN_INTERVAL` | Minimum seconds between session digests |
| `maxContextResults` | integer 1-20 | `5` | `NMEM_MAX_CONTEXT_RESULTS` | How many memories to inject at prompt time |
| `recallMinScore` | integer 0-100 | `0` | `NMEM_RECALL_MIN_SCORE` | Min relevance score (%) to include in auto-recall |
| `maxThreadMessageChars` | integer 200-20000 | `800` | `NMEM_MAX_THREAD_MESSAGE_CHARS` | Max chars per captured thread message before truncation |
| `captureExclude` | string[] | `[]` | — | Session key glob patterns to skip during auto-capture. `*` matches within a colon-segment. Example: `["agent:*:cron:*"]` |
| `captureSkipMarker` | string | `"#nmem-skip"` | — | In-band marker: any message containing this text skips capture for the session. Not sticky across compaction |
| `corpusSupplement` | boolean | `false` | `NMEM_CORPUS_SUPPLEMENT` | Register as MemoryCorpusSupplement for memory-core recall + dreaming |
| `corpusMaxResults` | integer 1-20 | `5` | `NMEM_CORPUS_MAX_RESULTS` | Max results per corpus supplement search |
| `corpusMinScore` | integer 0-100 | `0` | `NMEM_CORPUS_MIN_SCORE` | Min score for supplement results (0 = all) |
| `apiUrl` | string | `""` | `NMEM_API_URL` | Remote server URL. Empty = local (127.0.0.1:14242) |
| `apiKey` | string | `""` | `NMEM_API_KEY` | API key. Never logged. |

**Priority** (plugin-specific keys): `openclaw.json` (legacy) > pluginConfig > env var > default.
**Priority** (apiUrl/apiKey): `openclaw.json` (legacy) > pluginConfig > `config.json` (shared) > env var > default.

`parseConfig()` returns `_sources` object tracking where each value came from (`"file"`, `"pluginConfig"`, `"sharedConfig"`, `"env"`, `"default"`). Used by `nowledge_mem_status` tool.

Legacy aliases accepted silently in all sources for backward compat:
`autoRecall`→`sessionContext`, `autoCapture`→`sessionDigest`, `captureMinInterval`→`digestMinInterval`, `maxRecallResults`→`maxContextResults`.

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
| `GET /threads/search?query=&limit=` | `client.searchThreads()` | Thread search enrichment (best-effort, API-only) |
| `nmem --json t search <q> -n N` | `client.searchThreadsFull()` | Full thread search (CLI-first, API fallback) |
| `nmem --json t show <id> -n N --offset O` | `client.fetchThread()` | Fetch thread messages with pagination |

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

## Version Bump Checklist

All three files must match on every release:

1. **`package.json`** — `"version"` (npm registry reads this for `npm publish`)
2. **`openclaw.plugin.json`** — `"version"` (OpenClaw runtime reads this at load time)
3. **`CHANGELOG.md`** — new `## [x.y.z] - YYYY-MM-DD` section header

After bumping, commit inside the `community/` submodule, then stage the updated submodule ref in the parent repo.

## Known Gaps / Accepted Limitations

1. **Feed API `date_from`/`date_to`** - supported. Backend filters events by YYYY-MM-DD range. CLI: `nmem f --from/--to`. Plugin: `nowledge_mem_timeline` accepts `date_from`/`date_to`.
2. **Working Memory section edit** - supported. `nmem wm patch --heading "## X" --content/--append` does client-side read-modify-write. Plugin: `nowledge_mem_context` accepts `patch_section` + `patch_content`/`patch_append`.
3. **EVOLVES chain CLI** - supported. `nmem g evolves <id>` calls `/agent/evolves?memory_id=<id>`. Plugin: `nowledge_mem_connections` uses `client.graphEvolves()`.
4. **`unit_type` requires rebuilt backend** - `MemoryCreateRequest` includes `unit_type` (fixed). Restart backend after rebuild.
5. **Working Memory full-overwrite only via API** - the API (`PUT /agent/working-memory`) still takes full content. The section-level patch is implemented purely client-side. This is acceptable; the Knowledge Agent regenerates WM each morning anyway.

## Cache Safety Rules

- **Hooks**: always return `{ appendSystemContext }` — never `{ prependContext }`. `prependContext` injects into user-message space and breaks Anthropic's system prompt cache prefix on every turn.
- **CE assemble()**: return `systemPromptAddition` — same cache-safe position as `appendSystemContext`.
- **Never** embed dynamic content (timestamps, per-turn IDs) in system-prompt-level injection. Static behavioral guidance is fine; recalled memories are fine (they append after the cached prefix).


## Non-Goals

- Do NOT add `nowledge_mem_search` - `memory_search` covers it.
- Do NOT expose full WM overwrite from agents - section-level patch is the right granularity.
- Do NOT add cloud dependencies to the core path.
- Do NOT accept unknown config keys (strict parser in `config.js`).
