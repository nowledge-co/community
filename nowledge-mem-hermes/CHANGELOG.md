# Changelog

## [0.2.0] - 2026-04-01

### Changed

- Behavioral guidance rewritten for general-purpose use (research, writing, planning), not just coding.
- README now explains global (`~/HERMES.md`) and project-level guidance with merge-not-overwrite instructions.
- MCP tool prefix (`mcp_nowledge_mem_`) documented in AGENTS.md header for clarity.
- Graph exploration tools (`memory_neighbors`, `memory_evolves_chain`) highlighted in README.

### Fixed

- All MCP URLs changed from `localhost` to `127.0.0.1`.
- `integrations.json`: `graphExploration` corrected to `true`, `threadSave.method` corrected to `mcp-tool`.

## [0.1.0] - 2026-03-31

### Added

- MCP-based integration connecting Hermes Agent to the Nowledge Mem knowledge graph.
- Full MCP tool access: memory search, add, update, delete, Working Memory, thread operations.
- Behavioral guidance (`AGENTS.md`) for project-level memory behavior in Hermes sessions.
- Remote access configuration for multi-machine setups.
