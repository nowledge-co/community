# Changelog

## 0.2.1

- Kimi Code setup and slash-command guidance now treats `nmem` command/flag drift as an outdated CLI, not a broken Mem server. Agents are told to upgrade the same CLI source before retrying Kimi-specific MCP or thread-sync commands.

## 0.2.0

- Move Kimi Code thread capture into native `kimi.plugin.json` lifecycle hooks. Installing and enabling the plugin now registers sync hooks for `Stop`, `SessionEnd`, `PreCompact`, `SubagentStop`, and `Interrupt`; `scripts/install_hooks.py` remains as a fallback for older Kimi Code builds.
- Add plugin slash commands: `/nowledge-mem:status`, `/nowledge-mem:sync-now`, and `/nowledge-mem:import-history`.
- Capture Kimi subagent work by pairing the plugin's `SubagentStop` hook with `nmem` importer support for `agents/*/wire.jsonl`.

## 0.1.2

- Declare the bundled Nowledge Mem MCP connection as Streamable HTTP so Kimi Code uses the intended local transport consistently.

## 0.1.1

- Hide the child console window when Kimi Code lifecycle hooks run `nmem` on Windows.

## 0.1.0

- Add the first Kimi Code package with Kimi-native plugin metadata, a session-start skill, and a local Nowledge Mem MCP declaration.
- Add an explicit hook installer for Kimi Code `Stop`, `SessionEnd`, and `PreCompact` lifecycle events.
- Sync Kimi Code threads through `nmem t sync --from kimi-code --session-id ... --apply`, keeping local and remote Mem on the same transcript-import path.
