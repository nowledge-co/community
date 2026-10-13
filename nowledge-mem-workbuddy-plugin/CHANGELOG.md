# Changelog

## 0.2.1 - 2026-10-13

- Lead desktop installation with Plugins -> +, explicit enable/reload and MCP Trust checks instead of assuming slash commands register components in every WorkBuddy desktop release.
- Keep ordinary updates non-destructive; reserve removal/re-add for an explicitly diagnosed wrong-marketplace migration.
- Declare exact Spaces semantics on the bundled MCP connection and document native desktop connector overrides.
- Distinguish full-plugin lifecycle capture from the skill + MCP manual fallback.

- Treat `NMEM_CLI_PATH` as an explicit override. If it points to a missing
  executable, WorkBuddy hooks now fail open and log the missing CLI instead of
  silently falling back to a different system `nmem`.
- Automatic main-agent and subagent capture now uses the shared durable queue
  and never falls back to synchronous full-session import inside the hook.

## 0.2.0 - 2026-07-25

- Give WorkBuddy its own connector package and MCP identity instead of inheriting CodeBuddy provenance.
- Distribute WorkBuddy through its host-specific raw marketplace manifest and a sparse `git-subdir` checkout, avoiding WorkBuddy's `.codebuddy-plugin`-first repository-root resolution.
- Load current Nowledge context at session start and add a quiet memory-routing hint before prompts.
- Capture main-agent and subagent transcripts at `PreCompact`, `Stop`, `SubagentStop`, and `SessionEnd`, using WorkBuddy's separate `agent_id` so subagent messages cannot collide with the parent thread.
- Use WorkBuddy's managed Node runtime and resolve the desktop or standalone `nmem` CLI without relying on Python or a login-shell PATH.
- Bound startup context and fallback reads inside WorkBuddy's hook deadline.
- Keep WorkBuddy responsive when Mem is unavailable; hook failures are logged and never block the session.
