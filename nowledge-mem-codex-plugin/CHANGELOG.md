# Changelog

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

- Five composable skills: `working-memory`, `search-memory`, `save-thread`, `distill-memory`, `status`.
- Plugin manifest with marketplace metadata.
- Project-level `AGENTS.md` for stronger memory behavior in repos.
- Migration path from `nowledge-mem-codex-prompts`.
