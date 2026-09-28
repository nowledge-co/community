# Changelog

All notable changes to the `nowledge-mem-openhands-plugin` are documented in this file.

## [0.1.0] - 2026-09-28

### Added
- Initial release of the OpenHands plugin for Nowledge Mem.
- OpenHands plugin manifest (`.plugin/plugin.json`).
- OpenHands lifecycle hooks configuration (`hooks/hooks.json`):
  - `UserPromptSubmit`: Dynamic Context Bundle and Working Memory startup context injection.
  - `PostToolUse`: File tracking and artifact monitoring.
  - `Stop`: Conversation session synchronization and graceful completion capture.
- Bundled Python hook runtime (`hooks/nmem_shared.py`, `hooks/nmem-context.py`, `hooks/nmem-post-tool.py`, `hooks/nmem-stop.py`).
- Fast native HTTP REST transport (<30ms) with seamless fallback to `nmem` CLI.
- Standard OpenHands MCP configuration (`.mcp.json` and `mcp.json`).
- Seven canonical Nowledge Mem agent skills:
  - `read-working-memory`
  - `search-memory`
  - `distill-memory`
  - `save-handoff`
  - `save-thread`
  - `status`
  - `check-integration`
- Multi-agent orchestration support aligning with OpenHands, Raft, Multica, and Paseo workflows (`NMEM_AGENT_ID`, `NMEM_SPACE`).
- Rules and documentation in `README.md`, `AGENTS.md`, and `rules/nowledge-mem.md`.

### Fixed
- Enforce cross-host credential isolation in `get_effective_config` so global API keys are never paired with mismatched workspace URLs.
- Robust candidate path resolution in `hooks/hooks.json` across `OPENHANDS_PLUGIN_ROOT`, project plugin directories (`.openhands/plugins`, `.agents/plugins`, `.plugins`), user installed directories, and local execution paths.
- Thread import payload metadata routing (`space_id` and `agent_id`) to ensure correct space assignment during HTTP imports.
- Added `cwd` parameter to `run_nmem_command` ensuring CLI fallbacks execute reliably without argument errors.
- Non-destructive `sync_mcp_config_file` merging that preserves pre-existing MCP servers in `.openhands/mcp.json`.
- Failure preservation in offline queue during import errors and fail-closed timeout handling in `FileLock`.
- Synchronous bounded queue draining in `nmem-stop.py` before hook exit.
- Variable expansion support (`${NMEM_API_URL:-...}`) in `.mcp.json` and `mcp.json`.
