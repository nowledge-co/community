# Nowledge Mem for DimAgent

This package adds Nowledge Mem skills, local MCP defaults, and fail-open durable
capture hooks for DimAgent. Its runtime is intentionally DimAgent-specific even
though the manifest follows DimAgent's Codex-compatible plugin format.

## Capture contract

`PreCompact`, `Stop`, and `SubagentStop` invoke only:

```bash
nmem --json t capture --from dimagent --session-id <id>
```

The hook accepts success only when `nmem` returns `{"status":"enqueued"}`.
It never exports transcripts, reads transcript files, starts a detached worker,
or creates threads itself. Missing CLI, malformed hook input, timeouts, and
failed acknowledgements are recorded in a bounded local diagnostic log and do
not block DimAgent.

`SubagentStop` uses `agent_id`; the other events use `session_id`. The native
DimAgent importer and `nmem t capture --from dimagent` are supplied by Mem PR
https://github.com/nowledge-co/mem/pull/5224. Install this package only with a
Mem version that includes that importer.

## Install and verify

Install this directory through DimAgent's Codex-compatible plugin flow, restart
DimAgent, and trust the three Nowledge Mem lifecycle hooks if DimAgent requests
trust. The package intentionally does not claim a host-specific marketplace
command until DimAgent publishes one.

Keep `nmem` installed and configured. After a short DimAgent session, verify
the durable queue acknowledgement or resulting thread with:

```bash
nmem t list --source dimagent
```

Automatic capture is default-on through the lifecycle hooks. Filesystem watcher
capture remains disabled by default; enable it separately only when explicitly
needed.

## Manual fallback

Use `nmem --json t capture --from dimagent --session-id <id>` when a lifecycle
event was unavailable. This is an enqueue request, not a synchronous transcript
parse.
