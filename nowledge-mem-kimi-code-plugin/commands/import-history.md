---
description: Preview and import older Kimi Code conversations into Nowledge Mem.
---

Help the user backfill older Kimi Code sessions into Nowledge Mem.

If `nmem` exists but rejects `t sync --from kimi-code`, stop and report that the CLI is outdated. Ask the user to refresh the same CLI source first: desktop-bundled CLI via Mem Settings -> Preferences -> Developer Tools -> Install bundled CLI, PyPI via `python3 -m pip install --user --upgrade nmem-cli`, or pipx via `pipx upgrade nmem-cli`. Then retry the preview.

Preview first:

```bash
nmem t sync --from kimi-code --limit 20
```

If the user confirms the preview is right, import:

```bash
nmem t sync --from kimi-code --apply
```

If the user asked for all local sessions explicitly, use `--all-projects`. If they asked for a specific project, use `-p /path/to/project`. Explain that reruns are safe because Kimi session ids and message ids are stable.
