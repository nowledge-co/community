# Changelog

All notable changes to the Nowledge Mem OpenClaw plugin will be documented in this file.

## [0.8.5] - 2026-04-09

### Fixed

- **Removed the new host-version load gate that `0.8.3` introduced.** The runtime code did not change in `0.8.3`; the regression came from package metadata. Adding `openclaw.install.minHostVersion` made OpenClaw treat the package as host-gated at install and load time. When the host version could not be resolved cleanly in some environments, the plugin was skipped before registration, which made thread auto-sync disappear even though the Mem server was healthy. `openclaw.compat.pluginApi` and `openclaw.build.openclawVersion` remain for ClawHub validation, but the runtime loader no longer sees this package as load-gated.
- **Removed the unneeded `peerDependencies.openclaw` entry.** It was not the new regression introduced in `0.8.3`, but it also did not provide user value for this standalone plugin package.

## [0.8.3] - 2026-04-08

### Added

- Added a release validator and ClawHub publish runbook so package metadata, manifest defaults, and publish-time expectations can be checked before submission.

### Changed

- Added the external code-plugin metadata ClawHub expects in `package.json` and aligned the manifest-facing package description for official catalog review.
- Synced the checked-in `package-lock.json` package version with the actual plugin version so pack and publish surfaces stay coherent.
- Tightened the release validator so it now catches changelog drift, `openclaw.release` flag drift, unreadable required files, and config-schema contract changes before a ClawHub publish.
- Updated install guidance to use ClawHub as the primary path while keeping bare package names documented as a resolver fallback.

## [0.8.2] - 2026-04-08

### Changed

- **Assertive behavioral guidance replaces conditional phrasing.** The per-turn system prompt injection now uses "Search proactively... Do not wait to be asked" and "Save autonomously... Do not wait to be asked" instead of the previous "Before answering questions about prior work... search." This directly addresses reports of GPT 5.4 and Kimi K2.5 not proactively searching memories. Also trimmed redundant lines (signal examples, output-format description) to keep the injection tight (~60 tokens), restoring the "(not file paths)" hint.

## [0.8.1] - 2026-04-07

### Fixed

- **Thread provenance linking now handles API response shape.** The backend returns `source_thread` as an `{id, title}` object, but `_normalizeMemory` and `memory-get.js` assigned it directly to `sourceThreadId`, producing `[object Object]` instead of a usable thread ID. Both paths now extract the `.id` string, with fallbacks for the CLI string format and metadata `source_thread_id`.
- **Child process env no longer leaks `"undefined"` strings.** `spawn-env.js` set `NMEM_API_URL` and `NMEM_API_KEY` to JavaScript `undefined` to clear inherited values, but Node's `child_process` stringifies that to the literal `"undefined"`. Now uses `delete` to properly remove the keys.

## [0.8.0] - 2026-04-07

### Fixed

- **Cron and isolated-agent runs no longer sync into Mem threads by default.** OpenClaw schedules these as `agent:<agentId>:cron:...` (for example the `cron-worker` agent). They were previously captured like normal chat because `captureExclude` defaulted to empty and segment-based globs do not cover variable-depth keys. The plugin now calls OpenClaw's published `isCronSessionKey` from `openclaw/plugin-sdk/routing` (available since v2026.3.22, no duplicated parsing logic), also skips bare `cron:*` internal keys that the SDK does not classify, and applies this in hook handlers and Context Engine `afterTurn` (thread append + distillation).

### Added


- **Corpus supplement for OpenClaw dreaming.** Nowledge Mem's knowledge graph now participates in memory-core's recall pipeline and dreaming promotion. When `corpusSupplement: true` is set, memories stored in Nowledge Mem are searchable through memory-core's native `memory_search` tool and its three-phase dreaming system (light, deep, REM). Recalled Nowledge Mem content accumulates frequency, relevance, and diversity scores that feed into deep-phase promotion decisions. Cross-tool knowledge organically strengthens OpenClaw's local workspace memory.

  Enable in your OpenClaw config:
  ```json
  { "corpusSupplement": true }
  ```

  Three new config keys control the supplement: `corpusSupplement` (boolean, default false), `corpusMaxResults` (1-20, default 5), `corpusMinScore` (0-100%, default 0).

- **Duplicate recall prevention.** When the corpus supplement is active, the plugin's own search-based recall (in the hook and Context Engine) is automatically disabled. Working Memory injection continues as before. This prevents the same memories from appearing twice in the agent's context.

### Changed

- **Minimum OpenClaw version bumped to `>=2026.4.5`** for `registerMemoryCorpusSupplement` API support. Graceful fallback for older versions (registration silently skipped).

## [0.7.3] - 2026-03-30

### Added

- **Status tool now checks plugin trust and memory slot.** `nowledge_mem_status` reads `plugins.allow` from the OpenClaw config: warns when the allowlist exists but the plugin is missing (loading will be blocked); shows a tip when no allowlist is set (plugin loads via `entries.enabled`, but trust is implicit). Also warns when the memory slot points to `memory-core` instead of `openclaw-nowledge-mem` — a common misconfiguration after upgrading to OpenClaw 3.22+. Both checks include the exact fix command.
- **Clarified that no `tools.*` config is needed.** All plugin tools register automatically when the plugin loads. Listing `nowledge_mem_*` names in `tools.allow` is a misconfiguration — OpenClaw silently strips allowlists that contain only plugin entries. The only config users need is `plugins.allow: ["openclaw-nowledge-mem"]`. Updated troubleshooting in README, SKILL.md, and website docs (EN + ZH).

## [0.7.2] - 2026-03-30

### Added

- **Status tool now reports memory slot configuration.** `nowledge_mem_status` checks whether the OpenClaw memory slot points to `openclaw-nowledge-mem`. If another plugin (e.g. the built-in `memory-core`) holds the slot, the tool shows a warning with the fix command. This catches a common misconfiguration after upgrading to OpenClaw 3.22+, where the implicit slot default changed to `memory-core`.

### Fixed

- **Thread sync no longer depends on argv-sized CLI payloads.** OpenClaw conversation capture now creates and appends threads through the Mem HTTP API instead of passing whole message arrays through `nmem ... -m '<json>'`. This removes the transport limit that caused repeated append failures on long or repetitive sessions.
- **Session capture now syncs only the unsynced tail.** The plugin preserves the real transcript, asks Mem how many messages are already stored, and appends only the new tail instead of replaying the whole session on every hook or Context Engine turn.
- **Remote config is still unified after the transport change.** The same resolved `apiUrl` and `apiKey` from OpenClaw settings / `~/.nowledge-mem/config.json` now drive both CLI-backed memory tools and API-backed thread sync.
- **Removed lossy repetitive-session collapse.** The temporary content-based dedup workaround for cron-style sessions has been removed so conversation structure is preserved faithfully.

## [0.7.1] - 2026-03-23

### Fixed

- **Heartbeat sessions no longer trigger thread capture.** Sessions with `ctx.trigger === "heartbeat"` are now skipped in hook handlers. For cron-triggered heartbeat sessions (which use `trigger: "cron"`), a content-based dedup detects repetitive patterns: when >50% of messages in a session are duplicates, only unique messages are kept. This collapses 20 repetitive heartbeat messages down to 2, eliminating the CLI timeout caused by oversized payloads.

## [0.7.0] - 2026-03-23

### Added

- **Context Engine support.** The plugin now registers a full OpenClaw Context Engine alongside its memory slot. When you set `plugins.slots.contextEngine: "nowledge-mem"` in your OpenClaw config, the engine takes over context assembly, capturing, and compaction — replacing the hook-based approach with richer lifecycle integration:
  - **`assemble()`** — behavioral guidance and recalled memories injected via `systemPromptAddition` (system-prompt space, cache-friendly). Replaces the behavioral and recall hooks.
  - **`afterTurn()`** — continuous thread capture and triage/distillation after every turn, not just session end. More granular than the `agent_end` hook.
  - **`compact()`** — memory-aware compaction. When compacting old messages, the compactor is told which key decisions and learnings are already saved in your knowledge graph, so it can reference them concisely rather than losing them in summarization.
  - **`prepareSubagentSpawn()`** — when OpenClaw spawns parallel research agents, child sessions inherit your Working Memory and recently recalled memories automatically.
  - **`bootstrap()`** — pre-warms Working Memory on session start for instant first-turn context.
  - **`dispose()`** — clean session teardown.
- **Backward compatible.** When the CE slot is not activated, hooks continue working exactly as before. No config changes required for existing users.

### Fixed

- **Recalled memories no longer hurt prompt cache.** The recall hook now injects context via `appendSystemContext` (system-prompt space) instead of `prependContext` (user-message space). This preserves OpenClaw's prompt cache across turns. The fix applies to both the hook path and the new CE path.

## [0.6.15] - 2026-03-18

### Changed

- **Shared config for remote credentials.** The plugin now reads `apiUrl` and `apiKey` from `~/.nowledge-mem/config.json` — the same file used by nmem CLI, Bub, Claude Code, and other integrations. One config file connects all your tools. The legacy `~/.nowledge-mem/openclaw.json` is still honored at highest priority for backward compatibility, but is no longer the recommended path. New cascade for credentials: `openclaw.json` (legacy) > OpenClaw dashboard > `config.json` (shared) > env vars > defaults.

### Fixed

- **Trailing slash in API URL no longer causes 404.** URLs like `https://mem.example.com/` (with trailing slash) produced double-slash paths in API fallback requests. The URL is now normalized at construction time.

## [0.6.14] - 2026-03-17

### Added

- **Configurable thread message truncation.** New `maxThreadMessageChars` setting (200-20000, default 800) controls how many characters are preserved per captured thread message. Higher values keep more context in long conversations. Configurable via dashboard, config file, or `NMEM_MAX_THREAD_MESSAGE_CHARS` env var. Contributed by @blessonism.

## [0.6.13] - 2026-03-17

### Fixed

- **Dashboard config: API key field now masked correctly.** The manifest `uiHints` for `apiKey` used `"secret": true` but OpenClaw's `PluginConfigUiHint` type expects `"sensitive": true`. The field now renders as a password input in the OpenClaw dashboard.

## [0.6.12] - 2026-03-15

### Added

- **Agent behavioral skill**: the plugin now registers a `skills/memory-guide/SKILL.md` skill via the OpenClaw manifest `skills[]` array. OpenClaw auto-discovers it and presents it to the agent as an available skill. The skill teaches the agent when and how to search, save, explore connections, browse timelines, fetch past conversations, and use Working Memory. This is the single biggest change for memory recall quality: agents now receive structured guidance before their first memory interaction, rather than relying on tool descriptions alone.

### Changed

- **Behavioral guidance is now directive**: the always-on system hint now says "Before answering questions about prior work, decisions, dates, people, preferences, or plans: search with memory_search" instead of the previous "When prior context would improve your response, search." This matches the imperative pattern that LLMs follow most reliably, and explicitly notes "natural language queries, not file paths" to prevent confusion with OpenClaw's built-in file-based memory guidance.

## [0.6.11] - 2026-03-15

### Changed

- **Release-cycle alignment**: the OpenClaw plugin version now tracks the main Nowledge Mem `0.6.11` release line, so the published plugin and app-facing changelog stay in sync for this release.
- **Agent-assisted onboarding added**: the plugin now ships with a bundled `SKILL.md` playbook so AI agents can install, configure, verify, and explain the integration without collapsing the human docs into an agent script.
- **Aligned command execution with OpenClaw runtime**: the plugin now runs `nmem` through OpenClaw's runtime command runner instead of importing `child_process` directly. This removes gateway-blocking synchronous process calls from the plugin surface and matches current OpenClaw plugin abstractions.
- **Static guidance moved into system-prompt space**: the always-on behavioral hint now uses system-context injection instead of user-prompt prepend text, matching OpenClaw's newer `prependSystemContext` / `appendSystemContext` guidance for cacheable stable instructions.
- **Minimum supported OpenClaw version is now `2026.3.7`**: this is the first release with the system-context fields the plugin now relies on.
- **Package publishing is now explicit**: npm contents are pinned through the package manifest instead of relying on `.gitignore` fallback behavior, making releases more deterministic.

### Fixed

- **Health checks now keep the JSON contract**: the internal `status` probe now uses `--json`, matching the rest of the plugin's parseable CLI surface.
- **Resolved config now overrides inherited `NMEM_*` values cleanly**: child-process env construction now clears inherited `NMEM_API_URL` and `NMEM_API_KEY` before applying the effective plugin config, so local mode cannot accidentally inherit a stale remote backend.
- **Failure logs no longer echo full CLI argv**: plugin logs now record a sanitized command label instead of raw `nmem` arguments, avoiding retention of user queries or message batches in log files.
- **Thread CLI flag drift**: thread search and thread fetch now use `-n`, matching the current `nmem` thread CLI surface and the plugin's own internal docs.
- **Install and trust docs now match current OpenClaw behavior**: the docs now explain that `openclaw plugins install` enables the plugin and selects the memory slot automatically, and they document the recommended `plugins.allow` hardening path for non-bundled plugins.
- **Default-mode docs no longer over-promise auto-injected context**: Working Memory and recalled memories are now described as opt-in `sessionContext` behavior, not something every default install gets automatically.

## [0.6.9] - 2026-03-05

### Fixed

- **Auto-recall searched with full prompt instead of user message**: `event.prompt` contains the entire conversation history (system prompt + all prior turns), making recalled memories irrelevant as conversation grows. Now uses a tiered query strategy: substantial messages (>=40 chars) search alone; short messages (3-39 chars, likely follow-ups like "explain that more") include the last 3 messages as context for topic grounding; tiny messages (<3 chars) skip recall. Falls back to truncated `event.prompt` (500 chars) only when `event.messages` is unavailable.

### Added

- `recallMinScore` config option (0-100, default 0): Minimum relevance score threshold for auto-recalled memories. Set to e.g. 30 to filter out low-confidence results. Configurable via OpenClaw Config UI, config file, or `NMEM_RECALL_MIN_SCORE` env var.

## [0.6.8] - 2026-02-27

### Changed

- **Config priority flipped**: `~/.nowledge-mem/openclaw.json` now takes priority over OpenClaw plugin settings. Most users configure via OpenClaw UI (no file needed). Users who create the file get predictable overrides.
- **No auto-created config file**: The plugin no longer creates `~/.nowledge-mem/openclaw.json` on first startup. OpenClaw's settings UI works out of the box. Create the file manually when you need persistent or scripted config.
- **Status tool shows config sources**: `nowledge_mem_status` now shows where each setting comes from (`file`, `pluginConfig`, `env`, or `default`).

### Fixed

- **configSchema broke OpenClaw form UI**: `additionalProperties: true` (added in 0.6.7) caused OpenClaw's config form to show "Unsupported schema mode. Use Raw mode." Removed the field entirely - JSON Schema defaults to allowing additional properties when omitted, so typos still don't crash the plugin, and the form renders normally.

## [0.6.7] - 2026-02-27

### Added

- `nowledge_mem_status` tool: verify effective config, backend connectivity, and version. Shows mode (local/remote), whether API key is set, backend health, and all config values. 10 tools total.

### Fixed

- **configSchema too strict**: `additionalProperties` changed from `false` to `true`. Previously, a typo in openclaw.json config (e.g. `sesionContext`) caused the plugin to silently fail to load. Now OpenClaw passes validation and the plugin's own parser gives a descriptive error listing valid keys.
- **apiUrl port typo**: configSchema description had port 14142 instead of 14242.

## [0.6.6] - 2026-02-27

### Changed - Config file + env var cascade

**Config file at `~/.nowledge-mem/openclaw.json`**

The plugin now reads configuration from a dedicated config file, independent of OpenClaw's `openclaw.json`. The file is auto-created on first startup with sensible defaults. If you had settings in OpenClaw's plugin config, those values are automatically seeded into the file on first run. No manual steps needed.

This gives you a single, easy-to-find place for all Nowledge Mem settings. The file persists across plugin reinstalls and OpenClaw upgrades.

**Config cascade** (4 layers, highest to lowest priority):
1. `api.pluginConfig` - from OpenClaw's plugin config (when supported)
2. `~/.nowledge-mem/openclaw.json` - dedicated config file
3. Environment variables - `NMEM_SESSION_CONTEXT`, `NMEM_SESSION_DIGEST`, etc.
4. Built-in defaults

### Fixed

- **Conversation text unbounded**: `buildConversationText()` now caps per-message content at 2000 chars and total at 30K chars, preventing oversized LLM API payloads from long coding sessions
- **Config strict mode**: unknown config keys throw a descriptive error listing all valid keys
- **apiKey not written to config file**: API keys are intentionally excluded from the auto-created config file. They should stay in env vars or OpenClaw's secure config

### Added

- Environment variable support for all config keys (not just `apiUrl`/`apiKey`)
- Migration: first-run config file seeded from existing `pluginConfig` values
- `isDefaultApiUrl()` helper exported for local-vs-remote detection

## [0.6.5] - 2026-02-26

### Added - Thread tools + sourceThreadId linkage

**Two new tools for conversation retrieval.**

- `nowledge_mem_thread_search` - search past conversations by keyword. Returns matched threads with message snippets and relevance scores. Use when the user asks about a past discussion or wants to find a specific conversation.
- `nowledge_mem_thread_fetch` - fetch full messages from a specific thread with pagination support. Use to progressively retrieve long conversations. Accepts `offset` and `limit` for paginated retrieval.

**Memories now link back to their source conversations.**

Every memory distilled from a conversation now includes `sourceThreadId` in search results (`memory_search`) and individual lookups (`memory_get`). This enables the progressive retrieval workflow: search memories, see which thread they came from, fetch the full conversation for context.

**New client methods:**

- `client.searchThreadsFull(query, { limit, source })` - full-featured thread search (throws on error, supports source filter). CLI-first with API fallback.
- `client.fetchThread(threadId, { offset, limit })` - fetch messages from a thread with pagination. CLI-first with API fallback.

**Save deduplication.**

Before saving, the plugin checks for near-identical existing memories (>=90% similarity). If a match is found, the save is skipped and the existing memory is returned, preventing obvious duplicates at the plugin level. Deeper semantic dedup is handled by the Knowledge Agent's EVOLVES chains in the background.

**Context-aware behavioral guidance.**

The always-on hook now tells the agent about `nowledge_mem_thread_fetch` for following up on `sourceThreadId` links. When `sessionContext` is enabled, the guidance adjusts to note that relevant memories have already been injected, reducing redundant `memory_search` calls.

## [0.6.4] - 2026-02-26

### Changed - Thread search enrichment + sessionDigest default on

**`memory_search` now includes relevant conversation threads.**

When you search memories, the response now also includes `relatedThreads` - snippets from past conversations that match the query. This uses the backend's BM25 thread search (`GET /threads/search`). Thread search is best-effort: if it fails or returns nothing, the memory results are returned as before. No new tool for the agent to learn. Thread context surfaces automatically alongside memories.

**`sessionDigest` now defaults to `true`.**

Previously, session digest (thread capture + LLM distillation at session end) was off by default. The cost is negligible: one lightweight triage call per session end, full distillation only when worthwhile. Conversations are now captured and distilled automatically out of the box. Users who explicitly set `sessionDigest: false` are unaffected.

**Behavioral hook updated.**

The always-on guidance now mentions that `memory_search` returns conversation snippets alongside memories, so the agent knows to use the enriched results.

### Added

- `client.searchThreads(query, limit)` - calls `GET /threads/search` API. Returns top matching threads with message snippets and relevance scores. Best-effort: never throws.
- Version bumped to 0.6.4.

## [0.4.0] - 2026-02-26

### Changed - Rename config + always-on behavioral guidance

**Renamed config options** (old names still work as silent aliases):

| Old name | New name |
|----------|----------|
| `autoRecall` | `sessionContext` |
| `autoCapture` | `sessionDigest` |
| `captureMinInterval` | `digestMinInterval` |
| `maxRecallResults` | `maxContextResults` |

Existing configs with old names continue to work. Aliases are resolved transparently in `parseConfig()`. New names take precedence if both are present.

**Added: Always-on behavioral hook**

The agent now receives brief behavioral guidance (~50 tokens) on every turn via `before_prompt_build`, telling it to proactively save and search. This fires in ALL modes, including tool-only (default). Previously, without `sessionContext` enabled, the agent had no system-level instruction to use memory tools. Most LLMs ignored the "call proactively" hints in tool descriptions. This is the single most impactful change for memory adoption.

**Migrated: `before_prompt_build` for session context**

Session context injection (formerly "autoRecall") now uses the modern `before_prompt_build` hook instead of legacy `before_agent_start`. Both the behavioral hook and session context coexist. OpenClaw concatenates multiple `prependContext` values with `\n\n`.

## [0.3.0] - 2026-02-23

### Changed - Architecture overhaul: tool-first, LLM-based capture

**Breaking: `autoRecall` now defaults to `false`**

The agent has full access to all 7 tools regardless of this setting. Tool-only mode (both `autoRecall` and `autoCapture` off) is now the recommended default. The agent calls `memory_search`, `nowledge_mem_save`, etc. on demand. No tokens wasted on irrelevant context injection.

Users who explicitly set `autoRecall: true` are unaffected.

**Removed: English-only heuristic capture**

The entire rule-based capture pipeline has been removed:
- `shouldCaptureAsMemory()` - English-only regex patterns (`/\bi (like|prefer|hate)\b/i`)
- `MEMORY_TRIGGER_PATTERNS`, `PROMPT_INJECTION_PATTERNS`
- `looksLikeQuestion()`, `hasMemoryTrigger()`, `looksLikePromptInjection()`
- `fingerprint()`, per-session dedup map

These were fundamentally broken for non-English users (~95% of the world) and violated the "never settle for heuristic shortcuts" principle.

**Added: Two-step LLM capture pipeline**

Replaced heuristics with a proper LLM-based pipeline:

1. **Thread capture** (unconditional, unchanged) - full conversation appended to persistent thread
2. **Triage** (cheap, fast) - lightweight LLM call (~50 output tokens) determines if conversation contains save-worthy content. Language-agnostic. New backend endpoint: `POST /memories/distill/triage`
3. **Distillation** (only when worthwhile) - full LLM extraction via existing `POST /memories/distill`, creating structured memories with proper unit_type, labels, and temporal data

Cost: negligible for conversations without save-worthy content (triage only). Moderate for rich conversations (triage + distill). Works in any language.

**Enhanced: `memory_search` tool description**

More directive description for tool-only mode: tells the agent when to proactively search (past work references, previous decisions, prior context that would help).

**Migrated: `before_prompt_build` hook**

Auto-recall hook migrated from legacy `before_agent_start` to modern `before_prompt_build` API. Trimmed verbose tool guidance. The agent already sees tool descriptions in its tool list.

### Added

- `client.triageConversation(content)` - calls `POST /memories/distill/triage`
- `client.distillThread({ threadId, title, content })` - calls `POST /memories/distill`
- Backend `POST /memories/distill/triage` endpoint with lightweight LLM triage prompt

## [0.2.7] - 2026-02-18

### Added - Gap closures: date range, EVOLVES CLI, WM section edit

**Feed date range filtering**

- `nowledge_mem_timeline` now accepts `date_from` and `date_to` (YYYY-MM-DD) for exact temporal queries ("what was I doing last Tuesday?").
- `client.feedEvents()` passes `--from`/`--to` to `nmem f`; falls back to API `?date_from=&date_to=` params.
- Backend `GET /agent/feed/events` now accepts `date_from` / `date_to` query params alongside `last_n_days`.
- CLI: `nmem f --from 2026-02-17 --to 2026-02-17`

**EVOLVES version chain via CLI**

- `nmem g evolves <id>` - new CLI command showing the full EVOLVES chain for a memory (replaces/enriches/confirms/challenges relations).
- `client.graphEvolves()` - new client method using `nmem g evolves`; falls back to `GET /agent/evolves?memory_id=<id>`.
- `connections.js` now uses `client.graphEvolves()` instead of a raw API call. "Knowledge evolution" section now correctly shows direction (→ newer / ← older) relative to the queried memory.
- Backend `GET /agent/evolves` now accepts `memory_id` query param to filter edges for a specific memory.

**Working Memory section-level edit**

- `nmem wm patch --heading "## Notes" --content/--append` - new CLI subcommand. Does client-side read-modify-write: reads WM, patches just the target section, writes the full doc back.
- `client.patchWorkingMemory(heading, { content, append })` - new client method.
- `nowledge_mem_context` now supports optional `patch_section` + `patch_content`/`patch_append` parameters. An agent can now update one section of Working Memory without destroying the rest.
- Includes a JS `patchWmSection()` helper in `client.js` for the API fallback path (for CLI versions that predate `wm patch`).

## [0.2.6] - 2026-02-18

### Added - Rich save: labels, event_start, temporal_context, unit_type fixed

## [0.2.5] - 2026-02-18

### Added - Remote mode configuration

- `apiUrl` config option: set to your remote server URL to use Nowledge Mem across devices or in a team. Leave empty for local mode (default: `http://127.0.0.1:14242`).
- `apiKey` config option: API key for remote access. Marked `"secret": true` in uiHints so OpenClaw can mask it in the UI. **Never logged, never passed as a CLI argument.** Injected as `NMEM_API_KEY` env var into child processes only.
- `NowledgeMemClient` now accepts `{ apiUrl, apiKey }` credentials at construction time. Both config values and `NMEM_API_URL` / `NMEM_API_KEY` env vars are supported; plugin config wins over env vars.
- Initialization log now shows `mode=remote → https://...` vs `mode=local` (key never appears in logs).
- `_spawnEnv()` helper: builds per-spawn env with credentials injected; `_apiUrlArgs()` adds `--api-url` flag only when not local.

## [0.2.4] - 2026-02-18

### Changed - CLI-first architecture

All operations now go through the `nmem` CLI instead of direct API calls.
This is a structural alignment that makes every feature work in remote mode
(`NMEM_API_URL` + `NMEM_API_KEY`) without any plugin changes.

- `client.graphExpand()` - uses `nmem g expand <id>`; falls back to API on older CLI
- `client.feedEvents()` - uses `nmem f`; falls back to API on older CLI
- `client.search()` - CLI now returns `relevance_reason`, `importance`, `labels`,
  temporal fields natively; `searchRich()` is now an alias for `search()`
- `client.searchTemporal()` - uses `nmem m search --event-from/--recorded-from`
  CLI args; falls back to API if CLI is pre-bi-temporal-update
- `client._normalizeMemory()` - canonical memory shape shared across all search paths
- Removed `client.apiJson()` usage in `connections.js` and `timeline.js`
- `connections.js`: `client.apiJson()` retained only for the `/agent/evolves` chain
  (no CLI command for this yet, tracked as future improvement)

## [0.2.3] - 2026-02-18

### Changed - Graph Transparency & Scoring Visibility

- `nowledge_mem_connections`: completely rewritten output format
  - Edges are now JOIN-ed to their target nodes. Each connection shows its relationship type and strength
  - Sections organized by edge type: "Synthesized from N source memories" (CRYSTALLIZED_FROM), "Knowledge evolution" (EVOLVES), "Sourced from document" (SOURCED_FROM), "Entities mentioned" (MENTIONS)
  - EVOLVES sub-relations are labeled: supersedes, enriches, confirms, challenges
  - Each connected memory includes its `id` for direct follow-up with `memory_get` or `nowledge_mem_connections`
- `memory_search`: now always uses API path (`searchRich`), returns `matchedVia` with scoring breakdown
  - e.g. `"matchedVia": "Text Match (100%) + Semantic Match (69%) | decay[imp:high]"`
  - Also returns `importance` per result
  - Response `mode` field updated to `"multi-signal"` to reflect actual behavior
- `nowledge_mem_timeline`: timeline entries now include `(id: <memoryId>)` hint for events with linked memories, enables immediate chaining to `nowledge_mem_connections`
- `nowledge_mem_timeline`: `event_type` filter values documented in tool description for model discoverability
- Auto-recall hook: uses `searchRich` instead of CLI search, shows scoring breakdown in recalled context

### Added

- `client.searchRich()` - convenience wrapper for `searchTemporal` without temporal filters; always returns `relevanceReason`

## [0.2.2] - 2026-02-18

### Added

- `memory_search` now supports bi-temporal filtering:
  - `event_date_from` / `event_date_to` - when the fact/event happened (YYYY, YYYY-MM, YYYY-MM-DD)
  - `recorded_date_from` / `recorded_date_to` - when the memory was saved to Nowledge Mem
  - Uses API-direct path (`client.searchTemporal`) so it works regardless of installed CLI version
  - Results include `eventStart`, `eventEnd`, `temporalContext` when available
- `client.searchTemporal()` - new method wrapping `/memories/search` bi-temporal API directly

## [0.2.1] - 2026-02-18

### Added

- `nowledge_mem_timeline` tool: temporal feed browser wrapping `/agent/feed/events`. Answers "what was I working on last week?" with a day-grouped activity timeline. Supports `last_n_days`, `event_type`, and `tier1_only` filters.
- `memory_search` description now surfaces the full scoring pipeline (embedding + BM25 + labels + graph + decay)
- Recall hook updated: explicit tool routing for temporal queries (`nowledge_mem_timeline`) vs topic queries (`memory_search`/`nowledge_mem_connections`)

## [0.2.0] - 2026-02-18

### Changed - Tool Set Redesign

Redesigned from first principles around Nowledge Mem's v0.6 architecture.
This version reflects our genuine strengths: knowledge graph, structured types,
Working Memory, and cross-AI continuity.

### Added

- `nowledge_mem_save` tool: structured knowledge capture with `unit_type` parameter (fact, preference, decision, plan, procedure, learning, context, event). Replaces generic `nowledge_mem_store`
- `nowledge_mem_context` tool: read today's Working Memory daily briefing. Replaces `nowledge_mem_working_memory` with clearer naming
- `nowledge_mem_connections` tool: explore knowledge graph around a topic. Returns connected memories, EVOLVES chains, related entities, and Source document provenance (SOURCED_FROM edges from Library). This is our graph-native differentiator.
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
