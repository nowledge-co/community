# Changelog

## 0.1.0 (2026-03-12)

Initial release — brings cross-tool knowledge into Bub.

- 9 tools (`mem.search`, `mem.save`, `mem.context`, `mem.connections`, `mem.timeline`, `mem.forget`, `mem.threads`, `mem.thread`, `mem.status`) for searching and saving knowledge across all your AI tools
- Hook-based integration: behavioural guidance via `system_prompt`, optional Working Memory injection via `load_state`, incremental thread capture via `save_state`
- Two modes: default (agent-driven, on-demand) and session context (auto-inject Working Memory + recalled knowledge each turn)
- Conversations in Bub flow into Nowledge Mem so other tools can find them
- Pre-save deduplication check
- Bundled `nowledge-mem` skill for agent self-guidance
- Access Anywhere support via `~/.nowledge-mem/config.json` or `NMEM_API_URL` / `NMEM_API_KEY`
