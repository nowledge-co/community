---
name: status
description: Check whether Nowledge Mem is reachable and working. Trigger when memory commands fail, the user asks about Mem status, or during first-time setup.
---

Quick health check — is Nowledge Mem running, reachable, and configured correctly?

## Command

```bash
nmem --json status
```

## Interpretation

- If healthy, report briefly (mode, server version, memory count) and continue.
- If unreachable, suggest checking:
  1. **Local mode**: Is the Nowledge Mem desktop app running?
  2. **Remote mode**: Is `~/.nowledge-mem/config.json` configured correctly?
  3. **Auth errors**: Is the API key valid?

## When to use

- Memory commands are returning errors.
- User asks "is Mem working?" or similar.
- First time using Nowledge Mem in a new environment.
- After changing configuration.

## Links

- [Getting started](https://mem.nowledge.co/docs)
- [Remote access setup](https://mem.nowledge.co/docs/remote-access)
