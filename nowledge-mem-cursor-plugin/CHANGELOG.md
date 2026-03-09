# Changelog

## [0.1.1] - 2026-03-09

### Added

- Repository-level `.cursor-plugin/marketplace.json` for official Cursor Marketplace submission from the multi-integration `community` repository
- Local validator for plugin structure, MCP config, rule semantics, and marketplace manifest wiring
- Release guide for Cursor Marketplace submission and manual IDE validation

### Changed

- Tightened marketplace-facing plugin metadata with a docs-specific homepage, package-specific repository URL, and explicit keywords
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
