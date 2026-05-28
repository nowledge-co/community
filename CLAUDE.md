# Nowledge Community — Agent Guidelines

## Registry

[`integrations.json`](integrations.json) is the **single source of truth** for all Nowledge Mem integrations. It tracks capabilities, versions, install commands, transport, tool naming, and thread save methods.

**When adding or modifying any integration, update `integrations.json` first.** Other surfaces (website `integrations.ts`, desktop app integrations view, README tables, marketplace JSONs) derive from or validate against this file.

## Universal Install Contract — SKILL.md

`https://mem.nowledge.co/SKILL.md` is the **one URL** an AI agent can fetch before installing Nowledge Mem for a supported host. Source lives at <https://github.com/nowledge-co/nowledge-labs-website/blob/main/nowledge-mem/public/SKILL.md>. The design doc is <https://github.com/nowledge-co/mem/blob/main/docs/design/ONBOARDING_REVISIT_0_9_0.md>.

When adding or changing an integration's install command, update both:
1. The integration's row in [`integrations.json`](integrations.json) (`install.command`, `install.detectionHint`, `install.agentGuide`).
2. The matching row in the SKILL.md's "Step 2 — Install for that host" table, if the install command changes.

Per-tool `install.agentGuide` prompts in `integrations.json` should still point to `https://mem.nowledge.co/SKILL.md` first. Per-tool website pages are behavior and troubleshooting references after the connect loop starts, not the primary install contract.

The desktop app fetches this file at runtime from `https://raw.githubusercontent.com/nowledge-co/community/main/integrations.json` for plugin update awareness. Changes to the schema (adding/removing/renaming fields) affect:
- **Rust** (`lib.rs`): `fetch_plugin_registry`, `detect_installed_plugins`, `write_plugin_update_state`
- **TypeScript** (`plugin-update-manager.ts`): `RegistryIntegration` interface
- **Python** (`health.py`): `_read_plugin_update_state` reader

## Behavioral Guidance

[`shared/behavioral-guidance.md`](shared/behavioral-guidance.md) defines when plugins should search, save, read Working Memory, and distill. All plugins should align with this shared guidance.

Ambient space rule:
- Profile- or provider-owned space config should be the primary lane control when the host supports it.
- CLI-first integrations should honor `NMEM_SPACE` for one session-wide lane only when the host does not expose a better config surface. Legacy `NMEM_SPACE_ID` remains compatibility-only.
- General harness agents should support fixed, derived, or explicitly mapped lanes only when the host exposes that context truthfully.
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
