# Changelog

## [0.3.0] - 2026-04-02

### Added

- `nowledge_mem_save_thread` tool: captures the full session via OpenCode's SDK client and posts to Nowledge Mem's thread API over HTTP. Idempotent (create-or-append with deduplication). Handles large sessions without shell argument limits.
- HTTP transport layer (`nmemApi`) for thread operations alongside existing CLI transport for memory operations.
- Message extraction from OpenCode's SDK format (TextPart, ToolPart, ReasoningPart) to Nowledge Mem's thread message format with external IDs for deduplication.

### Changed

- `save_handoff` source changed from `generic-agent` to `opencode`.
- Session capture documentation rewritten to describe three-layer capture: background auto-sync, plugin full capture, and plugin proactive save.
- Behavioral guidance updated with `save_thread` usage instructions.

## [0.2.0] - 2026-04-02

### Added

- Compaction resilience hook (`experimental.session.compacting`): injects Working Memory reminder after context compaction so the agent stays aware of Nowledge Mem tools across long sessions.
- "How session capture works" documentation explaining the difference between background auto-sync (Claude Code) and plugin-driven proactive capture (OpenCode).

## [0.1.0] - 2026-04-01

### Added

- OpenCode plugin connecting to the Nowledge Mem knowledge graph.
- Seven registered tools: Working Memory, search, save, update, thread search, save handoff, status.
- Behavioral guidance injected into system prompt via `experimental.chat.system.transform`.
- All tools backed by `nmem` CLI for consistent behavior across integrations.
