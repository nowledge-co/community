# Changelog

## [0.1.1] - 2026-11-12

### Fixed

- Declare the exact Space protocol on direct HTTP session synchronization so
  workspaces using current Spaces can accept captured conversations.
- Preserve the selected destination; do not fall back to an unscoped write
  when a configured Space cannot be resolved.

## 0.1.0

- Add the native `NowledgeMem` capability and standalone `NowledgeToolset`.
- Bind trusted identity once per run and refresh bounded Context Bundle text.
- Add opt-in, acknowledged Thread capture with visible-message filtering.
- Add SDK/MCP integration tests and cross-platform package checks.
