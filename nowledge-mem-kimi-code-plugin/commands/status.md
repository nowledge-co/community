---
description: Check whether Nowledge Mem is connected in this Kimi Code session.
---

Check the Nowledge Mem connection for this Kimi Code session.

1. If the Nowledge Mem MCP server is available, read Context Bundle or Working Memory.
2. Run `nmem --json status` as the CLI fallback.
3. Summarize the result briefly, including whether MCP is connected and whether the CLI can reach Mem.
4. If `nmem` exists but rejects Kimi-specific helpers such as `config mcp show --host kimi-code`, treat it as an outdated CLI. Tell the user to refresh the same CLI source first: desktop-bundled CLI via Mem Settings -> Preferences -> Developer Tools -> Install bundled CLI, PyPI via `python3 -m pip install --user --upgrade nmem-cli`, or pipx via `pipx upgrade nmem-cli`.
5. If remote Mem or authenticated localhost appears misconfigured after the CLI is current, tell the user to run `nmem config mcp show --host kimi-code` and paste the generated server into `$KIMI_CODE_HOME/mcp.json` or `~/.kimi-code/mcp.json`.
