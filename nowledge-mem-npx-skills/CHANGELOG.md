# Changelog

All notable changes to the Nowledge Mem npx Skills will be documented in this file.

## [0.4.0] - 2026-03-09

### Changed

- **save-handoff** replaces the previous generic `save-thread` skill so the reusable package stays honest across agent runtimes that do not have a real transcript importer
- **read-working-memory** now prefers `nmem --json wm read` and keeps `~/ai-now/memory.md` only as a legacy fallback

## [0.3.0] - 2026-02-26

### Changed

- **search-memory**: add `--unit-type` filter, document `source_thread` field in results for thread provenance
- **distill-memory**: add `--unit-type` and `-l` (labels) flags to options and examples for structured saves

## [0.2.0] - 2026-02-14

### Added

- **read-working-memory** skill - Load daily Working Memory briefing at session start for cross-tool continuity

## [0.1.0] - 2026-01-24

### Added

- Initial release of npx skills format for Vercel `add-skill` CLI
- **search-memory** skill - Semantic search across personal knowledge base
- **save-handoff** skill - Leave resumable handoff summaries in generic agent environments
- **distill-memory** skill - Capture breakthrough moments as memories
- Support for Claude Code, Cursor, OpenCode, Codex, and 20+ agents
- Comprehensive README with installation and usage instructions
