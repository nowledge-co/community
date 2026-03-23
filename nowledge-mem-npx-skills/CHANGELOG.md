# Changelog

All notable changes to the Nowledge Mem npx Skills will be documented in this file.

## [0.6.0] - 2026-03-23

### Added

- **status** skill — check connection, server version, CLI version, and mode (local/remote) with `nmem --json status`
- **Autonomous save guidance** in distill-memory — agents are now encouraged to save proactively ("do not wait to be asked") with structured save fields (unit-type, labels, importance)
- **Contextual search signals** in search-memory — implicit recall language, debugging context, and architecture discussion now trigger proactive search
- **check-integration** detection table now references `community/integrations.json` as canonical source, with corrected install commands for all 8 agents

### Changed

- All skills aligned with `community/shared/behavioral-guidance.md` — the single source of truth for behavioral heuristics across all Nowledge Mem integrations

## [0.5.0] - 2026-03-23

### Added

- **check-integration** skill — detects the current agent, verifies nmem setup, and guides native plugin installation for richer features (auto-recall, auto-capture, graph tools)
- All skills now include a "Native Plugin" footer pointing agents to the check-integration skill and the integrations docs page

### Changed

- Skills are now positioned as the universal foundation layer: work in any agent via CLI, complemented by native plugins for platform-specific features

## [0.4.1] - 2026-03-11

### Added

- Restored **save-thread** as a deprecated compatibility skill so previously indexed installs do not break or silently disappear

### Changed

- **save-thread** now clearly redirects generic agent environments to honest handoff semantics instead of pretending to provide real transcript-backed thread import
- README now explains why shared skills cannot guarantee real thread save and when users should prefer native integrations like Gemini CLI or Claude Code

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
