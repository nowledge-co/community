# Changelog

All notable changes to the Nowledge Mem Claude Code plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.9] - 2026-05-12

### Changed

- SessionStart and compact Working Memory reload now share one hook script instead of duplicating the same shell pipeline in `hooks.json`. Behavior is unchanged: project-space Working Memory is tried first when a space resolves, then default-space `nmem wm read`, then `~/ai-now/memory.md`.
- Added regression coverage for the read hook's git-space resolution, `NMEM_SPACE` override, default-space fallback, and local file fallback.
- The `~/ai-now/memory.md` fallback remains available even if Claude Code launches a hook without `CLAUDE_PLUGIN_ROOT`.

## [0.7.8] - 2026-05-07

### Changed

- **`SessionStart` Working Memory now resolves a per-project `--space` from the session cwd.** Resolution order: `$NMEM_SPACE` env var → lowercased basename of the directory that holds the git common-dir (so worktrees share the main repo's space). When a `--space` resolves and the target space exists with non-empty Working Memory, that lane is injected; otherwise the hook falls back to the legacy default-space `nmem wm read`, then to `~/ai-now/memory.md`. Non-git directories do not pass `--space`, preserving the existing default-space behavior. Implements the "real ambient lane" pass-through described in `docs/PLUGIN_DEVELOPMENT_GUIDE.md` ("Space-aware execution") for Claude Code, where the session cwd + git context is the natural project lane.
- Same resolution applied to the `compact` matcher so post-compaction Working Memory reload uses the same project lane.
- **`Stop` and `PreCompact` thread capture now passes `--space` to `nmem t save`** using the same cwd-derived resolution. Without this, captured Claude Code threads land in the default space, so the desktop app's per-space daily distill (`~/ai-now/spaces/sp_<key>_<id>/memory.md`) cannot route them — every project's activity collapses back into the global daily Working Memory at `~/ai-now/memory.md`. Tagging threads at save time lets the existing per-space distill machinery actually fire on a per-project basis.

### Notes for users

- **Backward compatible.** If you have not enabled spaces (`nmem spaces enable`) or have not created a space whose name matches your repo basename, behavior is unchanged: the hook silently falls through to default-space `nmem wm read` and `nmem t save` runs without `--space` (no resolution, no tag).
- **To opt in:** `nmem spaces enable && nmem spaces create "<your-repo-basename>" --icon code`. From then on `nmem wm read --space "<repo>"`, the SessionStart hook, and the Stop/PreCompact thread save will all target that lane.
- **Override:** export `NMEM_SPACE=...` in your shell to force a specific space name regardless of cwd, for both Working Memory injection and thread save.

## [0.7.7] - 2026-05-02

### Fixed

- Stop capture now resolves macOS symlinked project paths before calling `nmem`, so Claude Code sessions launched from `/private/var/...` temp workspaces map back to the transcript directory Claude actually writes.
- Release E2E now covers Claude Code, Codex, OpenClaw, Hermes, and OpenCode live thread capture against an isolated Mem backend.

## [0.7.6] - 2026-05-02

### Fixed

- Stop capture now uses a bounded foreground hook instead of async fire-and-forget capture, so Claude Code has time to flush the transcript before `nmem t save` runs.
- Stop capture now treats an empty `nmem` result as retryable. The hook stays idempotent with the desktop watcher and PreCompact capture, but no longer reports success before a real thread was imported.
- Hook capture falls back to the legacy non-JSON `nmem t save` command when an older `nmem` build does not support the global `--json` flag.

## [0.7.5] - 2026-04-27

### Fixed

- Hooks now use `python3` or `python`, whichever is available, instead of assuming a `python3` binary exists.
- Stop and PreCompact capture now preserve WSL bridge installs where only Windows `nmem.cmd` is available, including WSL project paths passed to `nmem`.
- Stop and PreCompact capture now accept both `session_id` and `sessionId` hook payload keys, so current Claude Code payloads still avoid latest-session guessing.

## [0.7.4] - 2026-04-27

### Fixed

- Added a `PreCompact` hook that runs `nmem t save --from claude-code` before manual or automatic Claude Code compaction, so the full local transcript is captured before context is compressed.
- Stop and PreCompact capture now pass Claude's hook `session_id` and `cwd` into `nmem`, avoiding "latest session" guessing when multiple Claude Code sessions are active in the same project.

## [0.7.3] - 2026-04-08

### Changed

- Strengthened per-turn behavioral nudge from passive syntax hint to assertive guidance ("Search proactively when past knowledge would help", "Save decisions and learnings autonomously")

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
