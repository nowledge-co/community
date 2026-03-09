# Changelog

All notable changes to the Nowledge Mem Gemini CLI extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-07

### Added

- Initial Gemini CLI extension for Nowledge Mem
- Persistent `GEMINI.md` context for working memory, search, distillation, thread-save, and handoff behavior
- Six custom commands: read working memory, search memory, distill memory, save thread, save handoff, and status
- Five agent skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-thread`, and `save-handoff`
- Native Gemini thread-save guidance built around `nmem t save --from gemini-cli`
- Support for `NMEM_API_URL` and `NMEM_API_KEY` shell-level overrides alongside durable `nmem` config-file setup
- CLI-first remote setup guidance built around `~/.nowledge-mem/config.json`
- Release packaging, checksum generation, and GitHub Actions automation for tagged Gemini extension releases
- Release documentation and versioned release notes for reproducible Gemini marketplace publishing
- Native Gemini extension hooks for Working Memory bootstrap at session start and best-effort thread import at session end

### Changed

- Tightened the Gemini manifest to better match Gemini CLI extension reference guidance, including a gallery-facing description field
- Improved search, distillation, thread-save, and handoff prompts to prefer stronger `nmem` patterns like JSON mode, `--mode deep`, `--unit-type`, labels, and `-s gemini-cli`
- Corrected Gemini save semantics by restoring `save-thread` for real session import and keeping `save-handoff` as the distinct resumable-summary action
- Refined handoff guidance around a structured summary format with Goal, Decisions, Files, Risks, and Next
- Fixed collapsed multiline command examples in the Gemini skills so the shipped prompts and docs stay clear and copyable
- Clarified same-machine desktop setup, local-default status expectations, Working Memory empty-state behavior, Gemini install UX for local users, and the cross-agent memory lifecycle contract
