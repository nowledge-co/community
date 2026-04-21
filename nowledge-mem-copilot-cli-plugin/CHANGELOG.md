# Changelog

All notable changes to the Nowledge Mem Copilot CLI plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

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
- **Idempotent installer** (`install-hooks.sh`) — copies capture scripts to `~/.copilot/nowledge-mem-hooks/`
- **Cross-platform support** — Windows `nmem.cmd` fallback in hooks, Python runtime as primary
- **Space support** via `NMEM_SPACE` environment variable
- Registered in `integrations.json` as `copilot-cli` with `plugin-capture` thread save method
