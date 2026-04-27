# Changelog

All notable changes to the Nowledge Mem Copilot CLI plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-27

### Added

- **PreCompact capture** — captures the current Copilot transcript before context compaction, not only after model turns
- **SessionEnd capture backstop** — runs the same idempotent capture path when Copilot exits or clears a session

### Fixed

- **Marketplace install compatibility** — session capture now runs from packaged files in `hooks/`, so Copilot marketplace installs no longer depend on a missing `scripts/` directory
- **Stop hook fallback chain** — capture prefers the packaged runtime under `COPILOT_PLUGIN_ROOT/hooks/`, then falls back to `~/.copilot/nowledge-mem-hooks/` for older installs
- **Hook payload compatibility** — capture now accepts both camelCase and snake_case Copilot hook payloads, so newer Copilot CLI builds continue passing session and transcript identifiers correctly
- **Docs and release guidance** — no longer tell users to run a marketplace path that Copilot does not install
- **Capture runtime maintenance** — `scripts/` launchers now delegate to the packaged `hooks/` runtime instead of carrying a second copy that can drift

## [0.1.0] - 2026-04-21

### Added

- **Initial release** of the Nowledge Mem plugin for GitHub Copilot CLI
- **SessionStart hook** — loads Working Memory via `nmem --json wm read` on startup, resume, and clear; re-loads with checkpoint prompt on compaction
- **UserPromptSubmit hook** — per-turn behavioral nudge with search/save syntax (~35 tokens)
- **Stop hook** — Python-based session capture script reads transcript events, filters secrets, creates threads via `nmem t import`, auto-distills valuable sessions
- **4 skills**: read-working-memory, search-memory, distill-memory, save-thread
- **Skill-only surface** — no separate command docs are shipped for Copilot CLI, which avoids duplicated command/skill entries
- **Session capture script** (`copilot-stop-save.py`):
  - Stable per-session thread ID: `copilot-{session_id}`
  - Secret filtering (6 redaction patterns + 10 skip patterns)
  - Incomplete turn detection (questions, background tasks, ask_user)
  - File locking for concurrent session safety
  - Auto-distill with guardrails (cooldown, content hash dedup, minimum thresholds)
- **Idempotent installer** (`install-hooks.sh`) — compatibility fallback that copies capture scripts to `~/.copilot/nowledge-mem-hooks/`
- **Cross-platform support** — Windows `nmem.cmd` fallback in hooks, Python runtime as primary
- **Space support** via `NMEM_SPACE` environment variable
- Registered in `integrations.json` as `copilot-cli` with `plugin-capture` thread save method
