# Changelog — nowledge-mem-proma-plugin

## 0.1.3 (unreleased)

- Add `PROMA_ALLOWED_WORKSPACES` env var to `save-to-nmem.py` so users can restrict thread sync to a subset of Proma workspaces. Defaults to `default`, preserving current behavior for single-workspace installs. Sessions whose cwd lives under a non-allowlisted workspace are skipped with a log entry.

## 0.1.2 (2026-06-13)

- Align hooks with current Proma builds: install into `~/.proma/sdk-config/.claude/settings.json`, copy scripts to `~/.proma/scripts/`, and read transcripts from `~/.proma/sdk-config/projects/**/<session-id>.jsonl`.
- Add `UserPromptSubmit` capture for near-real-time thread sync, with `Stop` remaining as the fallback save.
- Replace stdout-only startup context with an idempotent Nowledge Mem block in Proma's workspace `CLAUDE.md`, preserving user-authored content and `CLAUDE.md.template`.
- Add `Stop` asyncRewake Working Memory refresh for live context reminders after assistant turns.
- Keep local/remote nmem config support and legacy `~/.proma/agent-sessions/` transcript fallback.

## 0.1.1 (2026-06-06)

- SessionStart now loads Context Bundle when available, then falls back to Working Memory. Proma receives identity, active scope, active rules, and current priorities on newer Nowledge Mem installs without losing compatibility with older `nmem` clients.

## 0.1.0 (2026-05-12)

- Initial Proma integration
- MCP server configuration template (`mcp.json` with `"servers"` key)
- Stop hook: automatic session capture via `save-to-nmem.py`
- SessionStart hook: Working Memory injection via `read-working-memory.py`
- 5 standard skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-thread`, `status`
- Proma session JSONL parser (dedup by UUID, extract text from content blocks)
- nmem REST API client (reads credentials from `~/.nowledge-mem/config.json`, supports local mode without an API key)
- Repeated Stop hook runs append to the existing Proma thread with deduplication
- `uvx` fallback for nmem CLI discovery (per plugin development guide)
- Static contract tests (`tests/plugin_e2e/test_proma_plugin.py`)
- Graceful fallback: hooks silent on error, skills available as manual alternative
