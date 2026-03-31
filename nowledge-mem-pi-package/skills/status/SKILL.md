---
name: status
description: "Check Nowledge Mem server connectivity and configuration. Use when memory commands fail or the user asks about setup."
---

# Status

## When to Use

- Memory commands return errors or unexpected results
- User asks "is Mem connected?" or "check my setup"
- First time using the plugin in a new environment

## Usage

```bash
nmem --json status
```

## Interpreting Results

**Healthy response includes:**

- Server status: running
- Version: server version number
- API URL: where the server is listening
- Capabilities: available features (search, threads, working memory)

**If it fails:**

1. Check that the Nowledge Mem desktop app is running, or that `nmem serve` is active on your server.
2. Verify `nmem` is installed: `pip install nmem-cli` or `pipx install nmem-cli`.
3. For remote servers, ensure `~/.nowledge-mem/config.json` contains valid `apiUrl` and `apiKey` fields, or set `NMEM_API_URL` and `NMEM_API_KEY` environment variables.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/pi)
- [Troubleshooting](/docs/troubleshooting)
