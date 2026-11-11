# Changelog

## [0.1.3] - 2026-11-12

- Disable redirects per authenticated HTTP request even when an injected
  synchronous or asynchronous client enables redirect following by default.

## [0.1.2] - 2026-11-12

### Fixed

- Declare the exact Space protocol on direct HTTP session synchronization so
  workspaces using current Spaces can accept captured conversations.
- Preserve the selected destination; do not fall back to an unscoped write
  when a configured Space cannot be resolved.

## [0.1.1] - 2026-10-08

- Top-level agent sync now uploads only the suffix after a verified
  acknowledged message anchor. Failed writes retain the cursor for retry, and
  compacted state falls back to stable-ID replay.
- Remote MCP connections use canonical slash-free endpoint URLs.
- Publish verified wheel and sdist through GitHub OIDC trusted publishing.

## 0.1.0

- Add sync and async LangChain agent middleware for transient Context Bundle injection.
- Add scoped Nowledge MCP tools with invocation-time Agent and Space identity enforcement.
- Add idempotent top-level LangGraph Thread sync without duplicating subgraph runs.
- Add explicit helpers for custom `StateGraph` applications.
