# Changelog

All notable changes to the Nowledge Mem Claude Code plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.2] - 2026-03-18

### Fixed

- **Slash commands `/search-memory`, `/save-thread`, `/distill-memory` now work.** Skill names had spaces (e.g. `Search Memory`) which Claude Code parsed as command "Search" + args "Memory", causing "Unknown skill" errors. Names now use hyphens matching all other plugins.

## [0.7.1] - 2026-03-09

### Changed

- Clarified the plugin's remote-mode contract so the Stop hook is documented as local client-side transcript capture through `nmem t save --from claude-code`, not server-side filesystem access
- Tightened README wording to match the unified Nowledge memory lifecycle: Working Memory, routed recall, real thread save, distillation, and honest handoff semantics

## [0.7.0] - 2026-03-04

### Added

- **Stop hook** for automatic session capture — runs `nmem t save --from claude-code` asynchronously after every response. Essential for remote mode where the desktop app file watcher cannot reach session files. Idempotent for local mode.
- **UserPromptSubmit hook** — per-turn behavioral nudge that injects search/save syntax as context Claude can see. Lightweight (~35 tokens) but significantly improves memory adoption.
- **`/status` command** — check Nowledge Mem server connection, API URL, and database status

### Changed

- **Plugin structure fixed** — `plugin.json` moved to `.claude-plugin/plugin.json` per Claude Code plugin spec. Ensures correct namespacing (`/nowledge-mem:search`, not `/nowledge-mem-claude-code-plugin:search`).
- **SessionStart hooks now use `nmem wm read`** — fetches Working Memory via API (works for both local and remote), with fallback to `cat ~/ai-now/memory.md` for local-only setups
- **SessionStart matcher broadened** — now covers `startup|resume|clear` (was `startup` only). Users resuming sessions or clearing context now get fresh Working Memory.
- **Stop hook uses `async: true`** — proper Claude Code background execution instead of shell `&`
- **Remote mode simplified** — config file (`~/.nowledge-mem/config.json`) replaces environment variable export. Set once, works everywhere.
- **Trimmed skill token overhead** — replaced verbose troubleshooting sections with concise guidance and `/status` reference
- **README rewritten** — concise, accurate, reflects v0.7.0 capabilities
- **marketplace.json version synced** — was stuck at 0.5.0, now 0.7.0

### Fixed

- **Working Memory fallback on server error** — when `nmem wm read` returns error JSON (e.g. connection refused), the python pipe now correctly exits non-zero, allowing fallback to `cat ~/ai-now/memory.md`

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
