# Changelog

## 0.1.0

- Add the first Kimi Code package with Kimi-native plugin metadata, a session-start skill, and a local Nowledge Mem MCP declaration.
- Add an explicit hook installer for Kimi Code `Stop`, `SessionEnd`, and `PreCompact` lifecycle events.
- Sync Kimi Code threads through `nmem t sync --from kimi-code --session-id ... --apply`, keeping local and remote Mem on the same transcript-import path.
