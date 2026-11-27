# Changelog

## [0.1.3] - Unreleased

- MCP follows the current Nowledge Mem connection when a new host session starts. Requires nmem 0.10.125 or later with the `mcp` command.

## Unreleased

- Automatic CodeBuddy capture now uses the shared durable per-session queue and
  never falls back to synchronous full-session sync in a lifecycle hook.

## [0.1.2] - 2026-11-20

- Add an opt-in model-facing reminder to check the approved Nowledge Bridge Agent mailbox.

## 0.1.1 - 2026-07-25

- Keep the CodeBuddy package scoped to CodeBuddy startup context, provenance, documentation, and marketplace loading.
- Move WorkBuddy to its dedicated connector package so both hosts keep independent MCP and transcript identities.
