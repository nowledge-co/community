---
description: Check Nowledge Mem connectivity from WorkBuddy.
---

Check whether Nowledge Mem is reachable:

```bash
nmem --json status
```

Then verify WorkBuddy-specific support:

```bash
nmem --json config mcp show --host workbuddy
nmem --json t sync --from workbuddy --limit 1
```

If status works but either WorkBuddy command is rejected, update the CLI from the same source and retry. For the desktop-bundled CLI, reinstall it from Mem Settings -> Preferences -> Developer Tools -> Install bundled CLI. For standalone installs, upgrade `nmem-cli`.
