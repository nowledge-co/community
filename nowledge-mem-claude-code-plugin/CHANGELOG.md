# Changelog

All notable changes to the Nowledge Mem Claude Code plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-03-02

### Added

- **Stop hook** for automatic session capture — runs `nmem t save --from claude-code` in the background after every response. Essential for remote mode where the desktop app file watcher cannot reach session files. Idempotent for local mode.
- **`/status` command** — check Nowledge Mem server connection, API URL, and database status

### Changed

- **SessionStart hooks now use `nmem wm read`** — fetches Working Memory via API (works for both local and remote), with fallback to `cat ~/ai-now/memory.md` for local-only setups
- **Trimmed skill token overhead** — replaced verbose troubleshooting sections with concise guidance and `/status` reference
- **README rewritten** — from 452 lines to ~90 lines. Concise, accurate, reflects v0.7.0 capabilities.
- **marketplace.json version synced** — was stuck at 0.5.0, now 0.7.0

## [0.6.1] - 2026-02-28

### Fixed

- Fixed hooks.json format to comply with Claude Code plugin specification
  - Added top-level "hooks" wrapper key as required by plugin system
  - Added description field for hook documentation
  - Resolves validation error: "expected record, received undefined"
  - Fixes compatibility with Claude Code 2.1.51+

## [0.6.0] - 2026-02-14

### Added

- **read-working-memory** skill — loads daily Working Memory briefing (`~/ai-now/memory.md`) at session start for cross-tool continuity
- **Lifecycle hooks** (`hooks/hooks.json`):
  - `SessionStart` (startup) — injects Working Memory context on new sessions
  - `SessionStart` (compact) — re-injects Working Memory after compaction and prompts agent to checkpoint progress via `nmem m add`
- Four skills total: search-memory, read-working-memory, distill-memory, save-thread

### Changed

- Version bump to 0.6.0 to align with Nowledge Mem v0.6 release

## [0.4.1] - 2025-10-23

### Added

- **Agent Skills**: Three autonomous skills for memory and thread management
  - `search-memory`: Autonomously search personal memories when context is needed
  - `distill-memory`: Recognize and capture valuable insights from conversations
  - `save-thread`: Save complete conversation threads on user request
- **MCP Server Integration**: Automatic configuration of Nowledge Mem MCP server
  - `memory_search`: Semantic + BM25 hybrid search with confidence scoring
  - `memory_add`: Create memories with labels and importance
  - `memory_update`: Update existing memories by ID
  - `list_memory_labels`: Browse available labels
  - `thread_persist`: Save Claude Code sessions (current or all)
- **Optimized Descriptions**: Reduced MCP overhead by ~40% while maintaining clarity
- **Comprehensive Documentation**: Installation, usage, troubleshooting, and best practices

### Changed

- MCP tool descriptions optimized for token efficiency
- Skills compressed to minimal token cost while preserving guidance quality

### Fixed

- N/A (initial release)

