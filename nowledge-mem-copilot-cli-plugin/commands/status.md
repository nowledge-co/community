---
description: Check Nowledge Mem connection and server status
---

# Status

Check your Nowledge Mem server status and connection.

## Command

```bash
nmem status
```

## Output

Shows:
- **Server status** — connected or unreachable
- **API URL** — where nmem is connecting (local or remote)
- **Database** — connected or disconnected
- **Version** — nmem CLI version

## Troubleshooting

If status shows errors:

1. **Server not running:** Start the Nowledge Mem desktop app, or run `nmem serve` on your server
2. **Wrong API URL:** Run `nmem config client set url https://...`, or set `NMEM_API_URL` for a temporary shell override (default: `http://localhost:14242`)
3. **Auth failed (remote):** Run `nmem config client set api-key ...`, or set `NMEM_API_KEY` for a temporary shell override
