# Changelog

## [0.1.1] - 2026-09-22

### Added

- Portable `explore-graph` skill, aligned with the canonical npx skills source,
  for focused Memory graphs and bounded progressive exploration.

### Changed

- Search routes Normal, Deep, and Progressive retrieval and automatically
  graphs non-empty Memory results. Inline, browser, and link fallbacks retain
  the configured identity and active space; graph failures preserve successful
  search results.

## [0.1.0] - 2026-08-08

### Added

- Initial Agent Plugins 1.0 package for Agent Plugins-compatible clients without a dedicated Nowledge Mem connector.
- Portable `plugin.json`, local Streamable HTTP `mcp.json`, and shared Nowledge Mem skills for Working Memory, recall, distillation, status, and handoff.
- Explicit capability boundary: this package does not promise automatic full-thread capture because Agent Plugins 1.0 does not standardize lifecycle hooks or transcript access.
