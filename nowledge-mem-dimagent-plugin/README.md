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

`SubagentStop` uses `agent_id`; the other events use `session_id`. Install
this package only with a Mem version that includes the native DimAgent importer
and `nmem t capture --from dimagent`. A containing release and supported-host
verification are still required before this integration is release-ready.

## Install and verify

Install this directory through DimAgent's Codex-compatible plugin flow, restart
DimAgent, and trust the three Nowledge Mem lifecycle hooks if DimAgent requests
trust. The package intentionally does not claim a host-specific marketplace
command until DimAgent publishes one.

Keep `nmem` installed and configured. After a short DimAgent session, check
for the eventually saved Thread with:

```bash
nmem t list --source dimagent
```

This lists persisted Threads, not queue acknowledgements. The capture command's
JSON `status: enqueued` confirms queue admission only; the background worker
still needs to parse and upload the session. If capture is unavailable, inspect
`$DIMCODE_HOME/logs/nowledge-mem-capture.log`, or
`~/.dim/logs/nowledge-mem-capture.log` when `DIMCODE_HOME` is unset. Diagnostics
contain neither transcript content nor credentials.

If no trusted Python interpreter can start, the native launcher writes a fixed
failure message to `nowledge-mem-capture-bootstrap.log` in that same log
directory. This separate file is overwritten, not appended, to remain bounded.

Packaged launchers select Python from absolute `PATH` directories before
executing it: `/bin/sh` on POSIX and the system Windows PowerShell on Windows.
Hook Python runs in isolated mode so project modules and `PYTHONPATH` cannot
override its standard-library imports. Automatic CLI discovery uses only
absolute `PATH` directories and known installation locations, never implicit
working-directory or relative `PATH` entries. For a custom installation, set
`NMEM_CLI_PATH` to the executable's absolute path. Missing trusted launchers
remain a logged capture failure, not a fallback to project-local commands.

Automatic capture is default-on through the lifecycle hooks. Filesystem watcher
capture remains disabled by default; enable it separately only when explicitly
needed.

## Manual fallback

Use `nmem --json t capture --from dimagent --session-id <id>` when a lifecycle
event was unavailable. This is an enqueue request, not a synchronous transcript
parse.

## Regression checks

```bash
python3 -m unittest discover -s nowledge-mem-dimagent-plugin/tests -v
```

The dedicated CI lane runs on Ubuntu, macOS and Windows. Tests execute the
registered platform launcher from an unrelated working directory, including
a plugin path with spaces, against a synthetic CLI. They verify all three
event IDs, exactly one content-free enqueue request, acknowledgement failure
and bounded diagnostics. Project-interpreter, module and CLI sentinels guard
against accidental execution from the host's working directory. This proves
the packaged launch contract, not that a real DimAgent host loaded the plugin
or that Mem persisted the capture.
