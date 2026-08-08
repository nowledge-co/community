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

The CLI check and ZCode MCP check are separate diagnostics. A remote or custom ZCode MCP endpoint can be healthy even when the local CLI is not configured for the same server.

If the local CLI check fails:

1. **Local:** open the Nowledge Mem desktop app and retry.
2. **Remote CLI:** verify the URL and API key in the user's own `nmem` client configuration.

For the ZCode MCP path, use the server's status tool when it is available. For remote or custom Mem, generate the host-owned configuration, paste it into ZCode's own MCP settings, and reload the Agent runtime:

```bash
nmem config mcp show --host zcode
```

Do not treat a local `nmem --json status` failure as proof that the ZCode MCP server is unavailable, or vice versa.
