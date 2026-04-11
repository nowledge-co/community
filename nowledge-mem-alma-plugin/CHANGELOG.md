# Changelog

## Unreleased

### Fixed

- Alma now lets blank host-default settings fall through to `NMEM_SPACE`, instead of pinning every untouched profile to `Default`.
- Empty `nowledgeMem.spaceTemplate` resolution now falls through to `NMEM_SPACE` / `Default` instead of short-circuiting Alma onto an unintended blank lane.
- Non-default Working Memory reads now surface real backend failures such as auth or connectivity errors instead of quietly pretending there is no briefing.
- Live settings reload now refreshes the reported ambient-space source as well as the space value itself, so status stays truthful after switching between plugin-owned and inherited lanes.
- Alma's Working Memory tool no longer fabricates the local `~/ai-now/memory.md` path for non-default spaces when no briefing is available there.
- Alma's Working Memory tool now returns a structured tool error when a non-default Working Memory request fails upstream, instead of crashing the command handler.
- Alma now treats a blank `nowledgeMem.space` as “no plugin-owned lane” because Alma's settings API does not distinguish an untouched default from an explicit empty string. That keeps launcher-owned `NMEM_SPACE` usable without forcing users to duplicate the same lane in Alma settings.

## 0.6.17

### Changed

- Alma's space settings and docs now lead with plugin-owned lane config (`nowledgeMem.space`, `nowledgeMem.spaceTemplate`) and keep `NMEM_SPACE` as a fallback for shell- or launcher-driven sessions without a richer config surface.

## 0.6.16

### Fixed

- Ambient spaces are now real for Alma's HTTP transport. Earlier builds documented `NMEM_SPACE`, but the plugin's HTTP client still sent memory, thread, source, and Working Memory requests without a lane. The client now injects the resolved space into both query and body paths, and non-default Working Memory reads no longer fall back to the Default-space file.

### Changed

- Alma now supports one profile-owned ambient lane through `nowledgeMem.space` and `nowledgeMem.spaceTemplate`, with `NMEM_SPACE` still available for launch-time routing.
- Status output now reports the effective ambient space and where it came from.

## 0.6.15

### Fix async flush race condition, error handling, and search mode

- Thread sync could permanently lose messages when new turns arrived during an in-flight flush. The message count is now snapshotted before async work begins, so messages pushed by hooks during the network call are correctly saved on the next flush.
- `dispose()` now awaits all pending flushes before tearing down, preventing data loss on plugin disable or reload.
- Recall injection in `willSend` is now wrapped in a try/catch so a server-unreachable or search failure does not break message sending.
- Search mode sent `"normal"` to the backend, which only accepts `"fast"` or `"deep"`. The unrecognized value silently fell through to deep mode (slower, more expensive). Now correctly sends `"fast"` as default. Tool schema updated to match.
- Store tool response fields (`title`, `labels`, `unit_type`, `importance`) were read from the raw API response instead of the unwrapped memory object, causing them to resolve to `undefined` when the API wraps the response in `{ memory: {...} }`.
- Error classification (`cliErrorResult`) used a cascade of `if` statements where later matches could overwrite more specific codes (e.g., "model not found" classified as `model_unavailable` instead of `not_found`). Refactored to an `else if` chain with most-specific patterns first.
- Removed phantom `force` parameter from delete tool schemas (the API does not support forced deletion).
- Removed phantom `input.messages` fallback in thread show tool (not in schema, never sent by LLM).

## 0.6.14

### Async HTTP transport (fixes Alma freeze on Windows)
- All data operations now use direct HTTP `fetch()` to the Nowledge Mem API instead of shelling out to the `nmem` CLI via `spawnSync`. This eliminates the event-loop blocking that caused Alma to freeze for seconds during recall injection and thread sync, especially on Windows where Python process startup is slow.
- The `nmem` CLI is no longer required for normal operation. The plugin connects directly to `http://127.0.0.1:14242` (or the configured remote URL). CLI availability is still checked in the status tool for diagnostic purposes.
- API key is passed via `Authorization: Bearer` header, never as a CLI argument or environment variable.

### Fix memory search, recall injection, and dedup check
- Memory search query parameter was `query` but the HTTP API expects `q`. All memory searches silently returned recent/browse-mode results instead of semantically relevant ones. This broke recall injection (random memories instead of relevant), dedup check in store (compared against wrong memories), and the search/query tools.
- Label filter parameter was `filter_labels` but the API expects `labels`. Label-based filtering was silently ignored.
- Time filter sent enum values (`today`, `week`) to the `event_date_from` field which expects date strings. Corrected to use the `time_range` parameter.

### Fix thread duplication on plugin restart or buffer eviction
- Conversations now use a stable thread ID derived from Alma's internal thread ID (SHA-1 hash). Previously, each plugin restart, LRU eviction, or Alma relaunch caused the same conversation to be saved as a new thread instead of appending to the existing one.
- First flush for a buffer now tries to append to the existing thread before falling back to create. This handles the case where the thread already exists in Nowledge Mem from a prior session.

### Remove dead code and phantom parameters
- Remove unused `saveActiveThread()`, `normalizeThreadMessages()`, `stringifyMessage()`, and `addMemory()` functions (superseded by hook-based live sync and direct HTTP calls).
- Remove `contentLimit` parameter from show/thread_show tools (the HTTP API returns full content; truncation was a CLI-only concept). Remove misleading `truncatedContent` response field.
- Remove unused `force` parameter from deleteMemory/deleteThread client methods (the HTTP API does not support forced deletion).
- Fix `createThread` fallback ID prefix from `cli-` to `alma-`.

## 0.6.13

### Reliable live thread sync (complete rewrite)
- Conversations sync during normal use — no need to quit Alma. Three hooks work together: `willSend` buffers the user message, `didReceive` buffers the AI response and starts a 7-second idle timer, `thread.activated` flushes the previous thread on switch. Quit hooks flush all buffered threads as a safety net.
- All message data comes from hook payloads (`input.content`, `input.response.content`), never from `context.chat.getMessages()` which returns empty in `willSend` timing.
- Thread titles resolved at flush time via `context.chat.getThread()` with 4-strategy fallback — Alma generates titles asynchronously after the first AI response, so early capture misses them.
- Incremental sync: first flush creates a new thread; subsequent flushes append only new messages to the existing thread. (Note: thread identity was session-scoped; cross-session dedup fixed in 0.6.14.)
- Per-thread idle timers: multiple concurrent conversations are tracked independently.
- Content-safe: AI responses in array-of-blocks format (Anthropic API style) are properly extracted.
- Thread buffer LRU eviction at 20 entries with best-effort flush before eviction.
- Concurrent flush guard prevents duplicate saves from overlapping timer/quit/switch triggers.

### Auto-capture on by default
- `autoCapture` now defaults to `true`. New users see thread sync working immediately.

### Broader write guidance
- Behavioral guidance now encourages saving facts and preferences from casual conversations, not just "architecture decisions" and "debugging conclusions."

## 0.6.4

### Behavioral guidance always injected
- Behavioral guidance (use memory tools, save decisions proactively, fetch source threads) is now injected on the first message of every thread, even when there are no existing memories or Working Memory yet. Previously, new users with zero memories got no guidance at all — the AI never learned about Nowledge Mem tools from the plugin alone.

### Recall injection stability
- Remove per-turn `generated_at` timestamp from injected context block — eliminates gratuitous variance in conversation history and improves token efficiency across turns

## 0.6.3

### Live settings reload
- Settings changes (apiUrl, apiKey, recallPolicy, autoCapture, maxRecallResults) now take effect immediately via `settings.onDidChange()`
- No longer requires plugin reload or Alma restart after changing Access Anywhere credentials
- Client is recreated with fresh credentials when apiUrl/apiKey change

### Status diagnostics tool
- Add `nowledge_mem_status` tool for checking connection health and configuration
- Returns: connection mode (local/remote), API URL, API key configured (boolean), CLI availability, server connectivity, and current settings
- Useful for verifying Access Anywhere remote configuration is working correctly

### Plugin lifecycle compliance
- `activate()` now returns `{ dispose }` per Alma `PluginActivation` contract
- Tool and event registrations collect `Disposable` handles for proper cleanup
- Alma can now cleanly unregister all tools and events on plugin deactivation

## 0.6.1

### Access Anywhere (remote access)
- Add `apiUrl` and `apiKey` settings for connecting to a remote Mem instance
- API key is injected via environment variable only (never as CLI arg, never logged)
- URL is passed via `--api-url` CLI flag (safe, not a secret)
- Startup log now shows `mode=remote` or `mode=local`

## 0.6.0

### Thread provenance (sourceThreadId linkage)
- Memory search, show, and query results now include `sourceThreadId` when the memory was distilled from a conversation
- Enables progressive retrieval: find memory -> trace to source conversation -> read full messages

### Structured save with dedup guard
- `nowledge_mem_store` now supports `unit_type` (fact, preference, decision, plan, procedure, learning, context, event)
- Temporal fields: `event_start`, `event_end`, `temporal_context` for when events happened (not when saved)
- Save dedup check: blocks saves at >=90% similarity to existing memories, preventing duplicates
- Dedup is best-effort and never blocks saves on search failure

### Thread pagination
- `nowledge_mem_thread_show` now supports `offset` for progressive retrieval of long conversations
- Returns `totalMessages`, `hasMore`, `returnedMessages` for client-side pagination awareness
- CLI uses `--limit`/`--offset` (requires nmem-cli >=0.6)

### Thread source filter
- `nowledge_mem_thread_search` now accepts `source` parameter to filter by platform (e.g. 'alma', 'claude-code')
- CLI uses `--source` flag (requires nmem-cli >=0.6)

### Behavioral guidance
- Recall injection hook now includes proactive save nudge and sourceThreadId awareness
- Updated CLI playbook with new flags (`--unit-type`, `--source`, `--offset`, `--limit`)

### Improved tool descriptions
- All tool descriptions updated to mention sourceThreadId linkage and progressive retrieval patterns
- Store tool description encourages proactive saving with structured types

## 0.2.13

- Improve quit auto-capture reliability by listening to `app.before-quit`/`app.beforeQuit` in addition to existing quit events
- Add `deactivate()` fallback capture when autoCapture is enabled and quit hook did not fire

## 0.2.12

- Fix quit event mismatch: listen to both `app.willQuit` and `app.will-quit`

## 0.2.11

- Fix auto-capture persistence bug: remove invalid `nmem t save --from alma` usage
- Auto-capture now serializes active Alma messages and persists via `nmem t create ... -s alma`
- Improve auto-capture skip reasons for clearer runtime logs

## 0.2.10

- Remove plugin command/slash surface (`searchAndIngest`, `clearStagedIngest`) for a cleaner UX
- Remove command registration permission and related staged-ingest runtime paths
- Keep integration focused on tools + recall/capture hooks

## 0.2.9

- Remove clipboard/input dependency from `Search and Ingest` (runtime-incompatible in current Alma API surface)
- Keep single-layer flow: query -> multi-select -> staged for next send
- Add explicit staged preview notification after selection

## 0.2.8

- Simplify `Search and Ingest` UX to single-layer flow: query -> multi-select -> copy
- Remove post-selection action picker to reduce friction
- Keep selected items staged for next send after successful copy

## 0.2.7

- Improve `Search and Ingest` UX with multi-selection support and clearer two-step flow
- Add explicit post-selection actions: stage for next send, copy to clipboard, insert into input (with clipboard fallback)
- Add stronger selection summary notifications to reduce confusion after selection

## 0.2.6

- Simplify configuration surface with single `nowledgeMem.recallPolicy` setting
- Keep runtime backward compatibility for legacy recall settings (`autoRecall`, `autoRecallMode`, `recallFrequency`)
- Add command-driven staged ingest flow (`Nowledge Mem: Search and Ingest`) for chat session context injection
- Add command to clear staged ingest per thread
- Continue including compact `nmem` CLI playbook in balanced recall mode for Bash fallback flows

## 0.2.5

- Add `nowledgeMem.recallFrequency` (`thread_once` / `every_message`) for controllable recall injection cadence
- Add `nowledgeMem.injectCliPlaybook` to include compact `nmem` fallback guidance in injected context
- Extend startup logging with effective recall policy details
- Update README policy matrix and examples for tool-hidden chat sessions

## 0.2.4

- Add explicit injected-context metadata in auto-recall block to reduce ambiguity vs live tool calls
- Add `nowledgeMem.autoRecallMode` setting with `balanced` and `strict-tools` policies
- In `strict-tools`, disable recall injection intentionally and log policy resolution at startup
- Improve configuration descriptions and add policy matrix/examples in README

## 0.2.3

- Standardize validation failures as structured errors (`validation_error`) instead of thrown exceptions
- Expand CLI error classification with `model_unavailable`
- Add explicit error-code documentation and quick input/output examples in README

## 0.2.2

- Normalize tool outputs to stable shapes (`ok/query/total/items` or `ok/item`)
- Add structured CLI error mapping (`nmem_not_found`, `not_found`, `permission_denied`, `cli_error`)
- Make delete defaults safer (`force: false` for memory/thread delete)
- Add update validation requiring at least one field change
- Add thread create validation requiring `content` or `messages`

## 0.2.1

- Add `nowledge_mem_query` one-shot tool to reduce ToolSearch-only loops
- Strengthen auto-recall instruction with fully-qualified tool ids (`nowledge-mem.*`)

## 0.2.0

- Add full on-demand memory tools: `show`, `update`, `delete` in addition to search/store
- Add on-demand thread tools: `thread_search`, `thread_show`, `thread_create`, `thread_delete`
- Extend search/store arguments with filters/labels/source for richer tool-driven flows

## 0.1.4

- Remove modal command integrations and switch to chat-native flow (tools + hooks only)
- Remove command contributions from manifest to avoid slash/input popups
- Keep auto-recall and auto-capture behavior as the primary UX

## 0.1.3

- Remove runtime `zod` dependency to fix Alma "Cannot find package 'zod'" plugin load error
- Replace tool schemas with plain JSON-schema objects and keep strict runtime input validation

## 0.1.2

- Add central-memory bridge mode via `chat.message.willSend` context injection
- Add chat/settings permissions and plugin configuration metadata
- Improve prompt steering to prioritize Nowledge Mem as external memory system

## 0.1.1

- Fix Alma `manifest.json` validation issues for local plugin install
- Normalize command IDs to `nowledge-mem.*` manifest convention
- Update README with explicit local plugin path install instructions

## 0.1.0

- Initial Alma plugin release
- Added 3 tools: search, store, and working memory
- Added command palette actions for status/search/save/read-thread
- Added optional auto-recall and auto-capture hooks
