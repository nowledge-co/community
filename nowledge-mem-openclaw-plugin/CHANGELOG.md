# Changelog

All notable changes to the Nowledge Mem OpenClaw plugin will be documented in this file.

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
