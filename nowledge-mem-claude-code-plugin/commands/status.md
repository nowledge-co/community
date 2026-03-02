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
2. **Wrong API URL:** Set `NMEM_API_URL` environment variable (default: `http://localhost:14242`)
3. **Auth failed (remote):** Set `NMEM_API_KEY` environment variable
