# Changelog

## [0.3.0] - 2026-04-01

### Added

- Setup script (`setup.sh`) that safely creates or appends behavioral guidance to `~/HERMES.md`.
- "Hermes memory vs Nowledge Mem" section in README explaining when to use each system.
- "Recalls but never saves" troubleshooting entry with fix.

### Changed

- Behavioral guidance setup is now documented as a **required** step, not optional. This is the most common setup issue: without `~/HERMES.md`, Hermes has tools but no instruction on when to use them proactively.
- AGENTS.md now explicitly addresses the dual-memory-system question: Hermes built-in memory for tool-specific facts, Nowledge Mem for cross-tool knowledge.
- `thread_persist` guidance now includes transparency note about transcript completeness.

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
