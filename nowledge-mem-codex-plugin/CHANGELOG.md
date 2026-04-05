# Changelog

## [0.1.1] - 2026-04-05

### Fixed

- **Install path**: corrected to `~/.codex/plugins/cache/local/nowledge-mem/local/` to match Codex plugin store layout.
- **Config**: added missing `[features] plugins = true` gate required by Codex to enable the plugin system.
- **Repo-level install**: replaced incorrect `cp` to `.agents/plugins/` with proper `marketplace.json` approach.
- **plugin.json**: removed fields Codex does not parse (`version`, `author`, `homepage`, `repository`, `license`, `keywords`).
- **Troubleshooting**: added "plugin is not installed" entry for path-related failures.

## [0.1.0] - 2026-03-31

### Added

- Five composable skills: `read-working-memory`, `search-memory`, `save-thread`, `distill-memory`, `status`.
- Plugin manifest with marketplace metadata.
- Project-level `AGENTS.md` for stronger memory behavior in repos.
- Migration path from `nowledge-mem-codex-prompts`.
