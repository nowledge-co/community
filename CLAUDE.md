# Nowledge Community — Agent Guidelines

## Registry

[`integrations.json`](integrations.json) is the **single source of truth** for all Nowledge Mem integrations. It tracks capabilities, versions, install commands, transport, tool naming, and thread save methods.

**When adding or modifying any integration, update `integrations.json` first.** Other surfaces (website `integrations.ts`, desktop app integrations view, README tables, marketplace JSONs) derive from or validate against this file.

The desktop app fetches this file at runtime from `https://raw.githubusercontent.com/nowledge-co/community/main/integrations.json` for plugin update awareness. Changes to the schema (adding/removing/renaming fields) affect:
- **Rust** (`lib.rs`): `fetch_plugin_registry`, `detect_installed_plugins`, `write_plugin_update_state`
- **TypeScript** (`plugin-update-manager.ts`): `RegistryIntegration` interface
- **Python** (`health.py`): `_read_plugin_update_state` reader

## Behavioral Guidance

[`shared/behavioral-guidance.md`](shared/behavioral-guidance.md) defines when plugins should search, save, read Working Memory, and distill. All plugins should align with this shared guidance.

Ambient space rule:
- CLI-first integrations should honor `NMEM_SPACE_ID` for one session-wide lane when the host already knows it.
- MCP/HTTP integrations should pass `space_id` directly when their runtime can do so.
- Do not add a second plugin-local “vault” abstraction.

## Plugin Development

See [`docs/PLUGIN_DEVELOPMENT_GUIDE.md`](docs/PLUGIN_DEVELOPMENT_GUIDE.md) for authoring rules, directory layout, and testing expectations.

## Submodules

`nowledge-mem-gemini-cli` is a nested submodule (separate repo with its own release cycle). All other integrations are normal directories in this repo.

## Commit Workflow

When modifying this repo as a submodule of the parent `muscat` repo:
1. Commit inside `community/` first
2. Then stage the updated submodule reference in the parent repo
