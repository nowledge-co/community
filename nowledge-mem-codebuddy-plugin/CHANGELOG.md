# Changelog

## Unreleased

- Automatic CodeBuddy capture now uses the shared durable per-session queue and
  never falls back to synchronous full-session sync in a lifecycle hook.

## 0.1.1 - 2026-07-25

- Keep the CodeBuddy package scoped to CodeBuddy startup context, provenance, documentation, and marketplace loading.
- Move WorkBuddy to its dedicated connector package so both hosts keep independent MCP and transcript identities.
