---
name: status
description: Check whether Nowledge Mem is reachable and working. Trigger when memory commands fail, the user asks about Mem status, or during first-time setup.
---

Quick health check: is Nowledge Mem running, reachable, and configured correctly?

## Command

```bash
nmem --json status
```

## Interpretation

- If healthy, report briefly (mode, server version, memory count) and continue.
- A healthy Mem server does not prove automatic Codex capture is running. If
  threads stopped appearing, inspect `/hooks` in the active Codex host. The
  exactly one intended Nowledge plugin source must be enabled and trusted. If
  setup names multiple enabled sources, disable the unintended marketplace or
  repo-local source and rerun setup before reviewing `/hooks`. After an update,
  `plugin contents changed; hook approval required` means capture is paused
  until the user reviews that source again. Setup cannot grant hook trust, and
  a blocked Stop hook cannot report its own failure. Run the installed setup
  after upgrading to migrate old duplicate host registrations, then restart
  Codex. Do not change another hook's state or approve hooks on the user's behalf.
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
