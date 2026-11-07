# Changelog

## 0.1.0

- Add the Nowledge Mem plugin for Dim: SessionStart Context Bundle / Working
  Memory with routing guidance, UserPromptSubmit routing text, Mem MCP server,
  five skills, and automatic Thread capture at each completed Stop.
- Capture reads the Session through Dim's `session export` with the daemon's own
  executable (never a `PATH` lookup), imports only operator and completed
  assistant text up to the last turn end with the checkpointed-delta contract
  of `nmem t import`, and re-imports in full when the imported prefix changed.
  State and diagnostics stay nmem-side, in a per-user directory checked before
  every write, with no conversation content; the state keeps the local position
  apart from Mem's acknowledged Thread count, so a full re-import into an
  existing Thread still leaves later Stops sending only the new messages.
- Support Collaboration member Sessions as their own Threads.
- Support Windows through `commandWindows` and a PowerShell launcher.
- Close both pending-marker handoff windows: a Stop delayed before publishing
  its marker retries ownership instead of leaving the final turn uncaptured.
