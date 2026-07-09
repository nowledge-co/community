---
description: Check Nowledge Mem connectivity from WorkBuddy or CodeBuddy.
---

Check whether Nowledge Mem is reachable.

Run:

```bash
nmem --json status
```

Then verify WorkBuddy-specific support:

```bash
nmem --json config mcp show --host workbuddy
nmem --json t sync --from workbuddy --limit 1
```

For CodeBuddy Code, use `--host codebuddy` and `--from codebuddy` instead.

If `status` works but the host-specific command is rejected, the CLI is outdated. Refresh the same CLI source first, then retry. For the desktop-bundled CLI, reinstall it from Mem Settings -> Preferences -> Developer Tools -> Install bundled CLI. For standalone installs, upgrade `nmem-cli`.
