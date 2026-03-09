# Changelog

## [0.1.0] - 2026-03-09

### Added

- Initial Cursor plugin package for Nowledge Mem
- Cursor plugin manifest with `.cursor-plugin/plugin.json`
- Bundled `.mcp.json` for local Nowledge Mem MCP connectivity
- Always-on Cursor rule for Working Memory, routed recall, distillation, and handoff semantics
- Four skills: `read-working-memory`, `search-memory`, `distill-memory`, and `save-handoff`
- Explicit design constraint that keeps `save-thread` unavailable until Cursor has a real Nowledge live session importer
