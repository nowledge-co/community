---
description: Load Context Bundle for startup context, or Working Memory for a lightweight daily briefing
---

Load the user's startup context before continuing.

## Workflow

Prefer Context Bundle when identity, active space, guidance, and Working Memory may matter:

```bash
nmem --json context --source-app codex
```

If the runtime already knows the current project or agent lane, add `--space "<space name>"`. If a multi-agent launcher starts this Codex worker, prefer setting `NMEM_AGENT_ID="<agent-slug>"` before launch. Use `NMEM_HOST_AGENT_ID` only for advanced host-id aliases.

Use Working Memory alone when you only need current priorities, or when `nmem context` is unavailable:

```bash
nmem --json wm read
```

If the Working Memory command succeeds but reports `exists: false`, say there is no Working Memory briefing yet.

Only if `nmem` is unavailable in an older local-only setup, fall back to:

```bash
cat ~/ai-now/memory.md
```

That fallback is only for older local-only **Default-space** setups.

Then summarize only the parts relevant to the task. If Context Bundle was loaded, do not separately read Working Memory unless the user asks for a lightweight refresh.

If remote access is configured through `~/.nowledge-mem/config.json`, let `nmem` use it naturally.
