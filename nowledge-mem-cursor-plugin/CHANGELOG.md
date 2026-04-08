# Changelog

## [0.1.4] - 2026-04-08

### Fixed

- Changed the Cursor plugin package id from `nowledge-mem` to `nowledge-mem-cursor` so local installs do not collide with Cursor's imported Claude-oriented `nowledge-mem` package surface.
- Updated the local install path to `~/.cursor/plugins/local/nowledge-mem-cursor` and tightened the release validator so this collision cannot silently regress.

## [0.1.3] - 2026-04-08

### Added

- Added a Cursor `sessionStart` hook that injects Working Memory into new sessions when `nmem` is available, with a graceful no-op fallback when it is not.

### Changed

- Switched the package guidance from "optional CLI for handoffs" to "recommended CLI for Working Memory bootstrap and handoffs" so the docs match the real best path.
- Updated the rule and Working Memory skill so Cursor does not immediately duplicate a fresh session-start Working Memory injection with another `read_working_memory` call.
- Extended the validator to require the new hook files and keep the session-start contract present for marketplace review.
- Hardened the session-start hook so unreadable legacy files fail soft and Windows installs can bootstrap through `nmem.cmd` instead of silently skipping Working Memory.
- Documented Cursor's local plugin installation path so users can install the package directly from `~/.cursor/plugins/local/` before Marketplace acceptance.
- Added troubleshooting for stale imported `nowledge-mem` packages so local Cursor testing does not silently load the older Claude-oriented package surface.

## [0.1.2] - 2026-04-08

### Changed

- Strengthened proactive search guidance from conditional to assertive ("Search proactively... Do not wait for the user to ask")
- Renamed "Writing Rules" to "Autonomous Save" with explicit "Do not wait for the user to ask" directive

## [0.1.1] - 2026-03-09

### Added

- Repository-level `.cursor-plugin/marketplace.json` for official Cursor Marketplace submission from the multi-integration `community` repository
- Local validator for plugin structure, MCP config, rule semantics, and marketplace manifest wiring
- Release guide for Cursor Marketplace submission and manual IDE validation

### Changed

- Tightened marketplace-facing plugin metadata with a docs-specific homepage, package-specific repository URL, explicit keywords, a display name, and an in-package logo asset
- Clarified the rule contract so `save-handoff` is named explicitly and `save-thread` remains unavailable until Cursor has a real Nowledge live session importer
- Clarified the README around local validation and release workflow

## [0.1.0] - 2026-03-09

### Added

- Initial Cursor plugin package for Nowledge Mem
- Cursor plugin manifest with `.cursor-plugin/plugin.json`
- Bundled `.mcp.json` for local Nowledge Mem MCP connectivity
- Always-on Cursor rule for Working Memory, routed recall, distillation, and handoff semantics
- Four skills: `read-working-memory`, `search-memory`, `distill-memory`, and `save-handoff`
- Explicit design constraint that keeps `save-thread` unavailable until Cursor has a real Nowledge live session importer
