# Changelog — nowledge-mem-proma-plugin

## 0.1.0 (2026-05-12)

- Initial Proma integration
- MCP server configuration template (`mcp.json`)
- Stop hook: automatic session capture via `save-to-nmem.py`
- SessionStart hook: Working Memory injection via `read-working-memory.py`
- nmem Skill with slash commands (`/nmem-save`, `/nmem-search`, `/nmem-status`)
- Proma session JSONL parser (dedup by UUID, extract text from content blocks)
- nmem REST API client (reads credentials from `~/.nowledge-mem/config.json`)
- Graceful fallback: hooks silent on error, skill works as manual alternative
