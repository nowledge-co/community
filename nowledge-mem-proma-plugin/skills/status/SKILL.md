# Status

Check Nowledge Mem connection status and configuration for Proma.

## When to Use

- User asks "Is nmem working?"
- After installing or updating the plugin
- MCP tools return errors
- Suspicion that the nmem server is down or unreachable

## Usage

**Primary (MCP)**:
```
mcp__nowledge-mem__status
```

**Fallback (CLI)**:
```bash
nmem status
```

## What to Check

1. **MCP tools available?** — Look for `mcp__nowledge-mem__*` in available tools
2. **Server reachable?** — `nmem status` should show `status: ok`
3. **API key configured?** — Check `~/.nowledge-mem/config.json` or `NMEM_API_KEY` env var
4. **mcp.json correct?** — Top-level key must be `"servers"` (not `"mcpServers"`), type must be `"streamableHttp"`
5. **Hooks configured?** — Check `~/.proma/settings.json` for Stop and SessionStart hooks
6. **Hook scripts present?** — Verify `~/.proma/hooks/save-to-nmem.py` and `read-working-memory.py` exist

## Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| No `mcp__nowledge-mem__*` tools | mcp.json not found or wrong key name; restart Proma |
| MCP tools return errors | Server unreachable; check `nmem status` |
| Hook scripts not firing | Python not in PATH; check `~/.proma/log/nmem-hook.log` |
| "nmem CLI not found" | Install via `pip install nmem-cli` or desktop app |

For remote Mem setups, verify `NMEM_API_URL` and `NMEM_API_KEY` are set, or check `~/.nowledge-mem/config.json`.
