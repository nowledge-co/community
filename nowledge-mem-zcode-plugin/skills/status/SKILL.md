---
name: status
description: Check whether Nowledge Mem is reachable and configured for ZCode, especially after setup or when memory operations fail.
---

# Status

Run a quick health check when the user asks whether Mem is working, when an operation fails, or after initial setup.

```bash
nmem --json status
```

Interpret the result briefly:

- report reachability, mode, server version, and memory count when healthy;
- if there is no briefing or data yet, distinguish that from a connection failure;
- do not print API keys or copy credentials into logs.

If the check fails, guide the user through the relevant path:

1. **Local:** open the Nowledge Mem desktop app and retry.
2. **Remote:** verify the URL and API key in the user's own `nmem` client configuration.
3. **ZCode MCP:** restart/reload the Agent runtime after changing Plugin MCP settings.

If MCP is available, the server's status tool may provide a more direct check; use it when appropriate and keep the CLI as a fallback.
