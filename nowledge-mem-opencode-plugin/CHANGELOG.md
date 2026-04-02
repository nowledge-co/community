# Changelog

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
