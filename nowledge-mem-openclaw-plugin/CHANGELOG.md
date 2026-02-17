# Changelog

All notable changes to the Nowledge Mem OpenClaw plugin will be documented in this file.

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
