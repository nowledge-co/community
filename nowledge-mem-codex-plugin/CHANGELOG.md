# Changelog

## [0.1.7] - 2026-04-27

### Improved

- **Remote MCP setup**: remote Codex users can now generate the exact `~/.codex/config.toml` MCP override with `nmem config mcp show --host codex`, using the same shared client credentials as direct `nmem` commands.
- **Credential boundary clarity**: package guidance now says plainly that direct MCP clients do not read `~/.nowledge-mem/config.json` automatically; Codex needs a host-owned MCP block for remote Mem.

## [0.1.6] - 2026-04-27

### Improved

- **Bundled local MCP**: the Codex plugin now ships a local Nowledge Mem MCP server definition, so a normal same-machine setup only needs the plugin enabled. Codex config still wins when users define their own `mcp_servers.nowledge-mem`, which keeps remote Mem and custom deployments explicit.
- **Setup clarity**: install docs now separate the required plugin enablement from the optional MCP override used for remote Mem or custom local endpoints.

## [0.1.5] - 2026-04-21

### Improved

- **Hybrid Codex setup**: the package now explicitly recommends `plugin + MCP` as the best modern Codex setup. The plugin package remains responsible for Working Memory guidance, `nmem` fallback, and real `save-thread`; MCP is now documented as the stronger retrieval and memory-write path when available.
- **Copy-paste config**: added a bundled `codex.config.example.toml` with the combined plugin + MCP block for local and remote Mem setups.
- **Package guidance**: `AGENTS.md` and the Codex skills now teach a hybrid operating model: prefer Nowledge Mem MCP tools for retrieval and memory writes when present, fall back to `nmem`, and keep `nmem t save --from codex` as the honest transcript-save path.

## [0.1.4] - 2026-04-21

### Improved

- **Marketplace-first install path**: home-level setup now uses `codex plugin marketplace add nowledge-co/community` as the primary flow.
- **Marketplace update path**: update guidance now leads with `codex plugin marketplace update nowledge-community`, then falls back to `upgrade` and legacy `codex marketplace add` where needed.
- **Legacy Codex compatibility**: docs now include fallback commands for builds that still expose only `codex marketplace ...`.
- **Config key clarity**: docs now distinguish `nowledge-mem@nowledge-community` (managed marketplace) from `nowledge-mem@local` (repo-pinned local source).
- **Install expectation clarity**: docs now state the required `/plugins` install step before enabling `nowledge-mem@nowledge-community` in config.

## [0.1.3] - 2026-04-11

### Improved

- **Codex guidance**: Working Memory now explicitly hands off to search on continuation-style tasks such as reviews, regressions, release prep, and integration debugging.
- **Distillation policy**: Codex guidance now tells the agent to do an explicit end-of-task review for durable memories instead of treating distillation as a vague optional behavior.
- **Remote setup**: docs now lead with `nmem config client ...` instead of manual JSON editing.

### Fixed

- **Install copy command**: Codex install/update instructions now preserve hidden files such as `.codex-plugin/plugin.json`.
- **Docs honesty**: removed wording that implied Codex has lifecycle-hook automation comparable to hosts like Claude Code or OpenClaw.

## [0.1.2] - 2026-04-06

### Fixed

- **YAML frontmatter**: quoted skill descriptions containing `: ` (colon-space) to prevent `serde_yaml` parse failures that silently dropped skills from the Codex UI.
- **Skill rename**: `read-working-memory` renamed to `working-memory`.

## [0.1.1] - 2026-04-05

### Fixed

- **Install path**: corrected to `~/.codex/plugins/cache/local/nowledge-mem/local/` to match Codex plugin store layout.
- **Config**: added missing `[features] plugins = true` gate required by Codex to enable the plugin system.
- **Repo-level install**: replaced incorrect `cp` to `.agents/plugins/` with proper `marketplace.json` approach.
- **plugin.json**: removed fields Codex does not parse (`author`, `homepage`, `repository`, `license`, `keywords`); kept `version` for desktop app update detection.
- **Troubleshooting**: added "plugin is not installed" entry for path-related failures.

## [0.1.0] - 2026-03-31

### Added

- Five composable skills: `read-working-memory`, `search-memory`, `save-thread`, `distill-memory`, `status`.
- Plugin manifest with marketplace metadata.
- Project-level `AGENTS.md` for stronger memory behavior in repos.
- Migration path from `nowledge-mem-codex-prompts`.
