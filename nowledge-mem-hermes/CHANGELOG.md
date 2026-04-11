# Changelog

## Unreleased

### Fixed

- Invalid `timeout` values in `~/.hermes/nowledge-mem.json` no longer crash the provider. Hermes now falls back to the default timeout and keeps the provider available.
- An explicit empty `space` in Hermes config now stays on `Default` instead of falling through to ambient `NMEM_SPACE`.
- Hermes CLI calls now honor that explicit Default-space choice end to end. Earlier builds still inherited `NMEM_SPACE` from the host process even after config resolved `space: ""`.
- Hermes no longer synthesizes identity-derived lanes when the host never provided a real `agent_identity`.

### Changed

- The fallback `NMEM_SPACE` example now shows the real launcher form (`NMEM_SPACE="Research Agent" hermes`) so users can run it directly.

## [0.5.7] - 2026-04-10

### Fixed

- Provider-level lane resolution now matches the shared contract: Hermes config wins over ambient `NMEM_SPACE`, instead of the environment silently overriding the provider's configured lane.

### Changed

- Added `space_by_identity` for exact Hermes identity → space mapping, alongside the existing fixed `space` and derived `space_template` options.

## [0.5.6] - 2026-04-10

### Changed

- Clarified Hermes' space model around the provider-level lane. `NMEM_SPACE`, `space`, and `space_template` all choose the ambient space by human-facing name, while shared-space retrieval, default retrieval mode, and agent guidance remain owned by Mem's shared `/spaces` profile.

## [0.5.5] - 2026-04-08

### Fixed

- Restored compatibility with Hermes releases that expose `tools.registry` without the newer `tool_result` helper. The provider now prefers Hermes' built-in JSON helpers when available and falls back to the same payload shape when they are not.
- Fixed native tool registration for plugin mode. The provider now exposes its `nmem_*` tool schemas before initialization, which prevents Hermes from advertising the tools and then falling back to its built-in `memory` store with `Unknown tool` errors.
- Native `nmem_save` writes now pass `source=hermes` instead of inheriting the CLI default, so memories render in Nowledge Mem with Hermes attribution rather than generic `cli`.

## [0.5.4] - 2026-04-08

### Fixed

- Fixed native tool calls when Hermes passes list-shaped arguments for `labels`, `filter_labels`, or `memory_ids`. Earlier builds assumed comma-separated strings and could fail immediately on valid save or search requests.
- Normalized provider tool responses so Hermes gets structured `success: false` errors instead of an untyped immediate tool failure.

## [0.5.3] - 2026-04-08

### Changed

- Clarified the release path: official Hermes distribution means upstreaming the provider into `NousResearch/hermes-agent`, not waiting for a separate marketplace surface.
- Tightened the release notes and install guidance so the native provider is presented as the primary path, with MCP kept as a fallback rather than the main story.

## [0.5.2] - 2026-04-07

### Fixed

- **Thread message limit was silently capped at 10.** The plugin default limit of 50 was only sent to the CLI when explicitly overridden. Since the CLI's own default is 10, all default `thread_messages` calls returned 10 messages while the plugin told the LLM it was requesting 50. The `-n` flag is now always passed.

## [0.5.1] - 2026-04-07

### Fixed

- **Install path**: `setup.sh` now installs to `~/.hermes/plugins/nowledge-mem/` instead of `~/.hermes/plugins/memory/nowledge-mem/`. Hermes scans direct children of `plugins/`, so the nested `memory/` directory was invisible to the plugin loader.
- **Python imports**: changed bare imports (`from provider import ...`, `from client import ...`) to relative imports (`from .provider`, `from .client`). Hermes loads plugins via `importlib` with namespaced modules, which requires relative imports within the package.

## [0.5.0] - 2026-04-04

### Added

- **Native memory provider plugin** for Hermes v0.7.0+. Implements the `MemoryProvider` ABC with lifecycle hooks that replace behavioral guidance with deterministic behavior.
- **Automatic Working Memory injection** via `system_prompt_block()`. No manual `read_working_memory` tool call needed.
- **Per-turn proactive recall** via `prefetch()`. Relevant memories are searched and injected as context before every LLM call, without relying on SOUL.md guidance compliance.
- **User profile mirroring** via `on_memory_write()`. When Hermes writes a user fact to its built-in USER.md, the fact is also saved to Nowledge Mem for cross-tool availability.
- **Compression awareness** via `on_pre_compress()`. The context compressor is told that external knowledge exists and can be recovered via search.
- **6 native tools** with clean `nmem_` prefix (e.g. `nmem_search` instead of `mcp_nowledge_mem_memory_search`). Graph tools (neighbors, evolves, labels) deferred until `nmem` CLI adds those commands.
- **`hermes memory setup` integration** via `get_config_schema()` and `save_config()`.
- **CLI-only client** (`client.py`) using only stdlib (subprocess + json). Shells out to `nmem` CLI, which handles server URL, API key, and remote access. No duplicate HTTP transport or config surface.
- **Upsert by ID** on `nmem_save`: pass a stable `id` to create-or-update in one call. Eliminates the search-then-update dance for agents that track their own memory keys.

### Changed

- `setup.sh` now supports `--plugin` (default) and `--mcp` flags for choosing install mode.
- README rewritten for dual install paths: plugin (recommended) vs MCP-only (alternative).

## [0.4.0] - 2026-04-02

### Fixed

- **Behavioral guidance placement**: `~/HERMES.md` is not found by Hermes when working inside a git repository (the file walk stops at the git root). Changed primary placement to `~/.hermes/SOUL.md`, which is loaded on every session regardless of working directory.

### Changed

- `setup.sh` is now self-contained: downloads AGENTS.md from GitHub, no repo clone required. Run with `bash <(curl -sL ...)`.
- `setup.sh` now handles both MCP config and behavioral guidance in one command.
- All docs (README, website EN/ZH) updated to lead with one-command setup.
- Troubleshooting section documents the `~/HERMES.md` git repository limitation.

## [0.3.0] - 2026-04-01

### Added

- Setup script (`setup.sh`) that safely creates or appends behavioral guidance.
- "Hermes memory vs Nowledge Mem" section in README explaining when to use each system.
- "Recalls but never saves" troubleshooting entry with fix.

### Changed

- Behavioral guidance setup is now documented as a **required** step, not optional. This is the most common setup issue: without guidance, Hermes has tools but no instruction on when to use them proactively.
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
