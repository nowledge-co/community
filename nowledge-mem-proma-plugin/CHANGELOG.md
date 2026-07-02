# Changelog — nowledge-mem-proma-plugin

## 0.1.4 (2026-07-02)

- Hide the child console window when the Proma startup/asyncRewake hook reads Nowledge Mem context through `nmem` on Windows.

## 0.1.3 (2026-06-22)

- Add optional `PROMA_ALLOWED_WORKSPACES` filtering to `save-to-nmem.py` for multi-workspace Proma users. Leaving it unset keeps the previous behavior and syncs every workspace; setting a comma-separated list such as `default,research` skips other workspaces with a log entry.
- Use `$HOME/.proma` and `python3` in the packaged `hooks/hooks.json` commands instead of relying on a `PROMA_HOME` environment variable. Proma v0.13.0 does not set `PROMA_HOME` for SDK hook commands by default, so copied hook templates now work without extra shell environment setup.
- Document Proma v0.13.0's built-in Nowledge Mem setup card as the easiest starting point, while keeping this package as the canonical hook/script source.

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
