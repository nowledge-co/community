---
name: status
description: Check Nowledge Mem connection status, server version, CLI version, and configuration. Use when diagnosing issues or verifying setup.
---

# Status

> Quick diagnostic for Nowledge Mem connectivity and configuration.

## When to Use

- User asks "is my memory working?" or "check status"
- Memory operations are failing or returning errors
- After initial setup to verify everything is connected
- When switching between local and remote mode

## Usage

```bash
nmem --json status
```

This shows:
- **Connection**: whether the Nowledge Mem server is reachable
- **Server version**: which version of the backend is running
- **CLI version**: which version of `nmem` is installed
- **Mode**: local or remote (with API URL)
- **Database**: whether the knowledge graph is connected

## Troubleshooting

If status fails:
- Ensure the Nowledge Mem desktop app is running, or start the server manually
- Check that `nmem` is installed: use the desktop app's **Install CLI**, `pip install nmem-cli`, `uvx --from nmem-cli nmem`, or on Arch Linux `yay -S nmem-cli` / `paru -S nmem-cli`
- For remote mode, verify `~/.nowledge-mem/config.json` has correct `apiUrl` and `apiKey`

## Native Connector

These skills work in any agent via CLI. For auto-recall, auto-capture, and graph tools, check if your agent has a native Nowledge Mem connector — run the `check-integration` skill or see https://mem.nowledge.co/docs/integrations
