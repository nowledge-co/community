# Changelog — nowledge-mem-proma-plugin

## 0.1.0 (2026-05-12)

- Initial Proma integration
- MCP server configuration template (`mcp.json` with `"servers"` key)
- Stop hook: automatic session capture via `save-to-nmem.py`
- SessionStart hook: Working Memory injection via `read-working-memory.py`
- 5 standard skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-thread`, `status`
- Proma session JSONL parser (dedup by UUID, extract text from content blocks)
- nmem REST API client (reads credentials from `~/.nowledge-mem/config.json`)
- `uvx` fallback for nmem CLI discovery (per plugin development guide)
- Static contract tests (`tests/plugin_e2e/test_proma_plugin.py`)
- Graceful fallback: hooks silent on error, skills available as manual alternative
