---
name: status
description: Check Nowledge Mem connectivity, CLI and server versions, and configuration. Use when memory reads or saves fail, when the user asks whether memory is working, or after changing Mem settings.
---

# Status

A quick diagnostic for the Nowledge Mem connection behind this Dim Session.

## Usage

```bash
nmem --json status
```

This reports whether the Mem server is reachable, the server and CLI versions, the local or remote mode with its API URL, and whether the knowledge graph is connected.

If a Mem MCP tool whose description reads status is available, it returns the same facts; the CLI is the fallback when MCP is not configured.

## What to check

- **Connection**: if unreachable, start the Nowledge Mem desktop app or server, then retry once.
- **CLI**: if `nmem` is missing, install it from the desktop app's **Install CLI**, `pip install nmem-cli`, or `uvx --from nmem-cli nmem`. Set `NMEM_CLI_PATH` when the executable lives outside the usual locations.
- **Remote mode**: verify `~/.nowledge-mem/config.json` has the intended `apiUrl` and `apiKey`; a key is never printed.
- **MCP tools missing in Dim**: the plugin's server entry lives in this package's `mcp.json`. A remote Mem is selected with `NMEM_MCP_URL`; a keyed remote needs the user's own MCP entry, because plugin MCP entries are read-only. Show the current method with `nmem config mcp show`.
- **Hooks**: in a Dim Session, the `/hooks` panel lists this package's SessionStart, UserPromptSubmit, and Stop handlers and their last result. A hook failure never blocks a turn. A CLI form exists for the user to run outside a Session; never run a Dim CLI yourself from inside the Session, because a CLI of another version can replace the running daemon.

Report the concrete state you observed. If the connection is down, say memory is unavailable this session and continue; do not describe a failed call as an empty memory.
