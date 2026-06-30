# Changelog

All notable changes to the Nowledge Mem Pi package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.2] - 2026-06-30

### Added

- Inject Context Bundle at Pi session startup through the native `before_agent_start` hook, with Working Memory fallback for older or unavailable clients.
- Refresh startup context after Pi compaction so long sessions keep the latest AI Context without re-reading on every turn.

### Changed

- Keep the startup guidance compact and aligned with the shared Nowledge Mem guidance instead of duplicating full skill instructions inside the extension.
- Restrict the legacy `~/ai-now/memory.md` fallback to default local mode so explicit spaces, AI Identities, and remote servers do not receive stale Default-space context.

## [0.8.1] - 2026-06-10

### Fixed

- Exposed `nowledge-mem-pi-sync` as the package binary so older `nmem` installs can still backfill historical Pi sessions.

## [0.8.0] - 2026-06-10

### Added

- Added a native Pi extension that automatically syncs completed Pi sessions into Nowledge Mem threads.
- Session capture is idempotent: the plugin writes stable Pi entry IDs and appends only new transcript messages.
- Added final flushes for session switches, compaction, and shutdown so `/new`, resume, and exit keep thread history complete.
- Added `nowledge-mem-pi-sync`, a preview-first historical import command for older Pi session files.

## [0.7.1] - 2026-06-07

### Changed

- Behavioral guidance now starts with Context Bundle and falls back to Working Memory for older clients.
- Added explicit multi-agent AI Identity and space rules for `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, and `NMEM_SPACE`.

## [0.1.0] - 2026-03-31

### Added

- Initial release with five skills:
  - `read-working-memory`: Daily briefing with focus areas, priorities, and recent changes
  - `search-memory`: Semantic search across memories and past conversations
  - `distill-memory`: Save decisions, procedures, and insights as durable memories
  - `save-thread`: Structured handoff summaries for session continuity
  - `status`: Server connectivity check
- Behavioral guidance companion (`AGENTS.md`)
- Pi package manifest for `pi install npm:nowledge-mem-pi`
