# Changelog

All notable changes to the Nowledge Mem Pi package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.1] - 2026-06-07

### Changed

- Behavioral guidance now starts with Context Bundle and falls back to Working Memory for older clients.
- Added explicit multi-agent identity and space guidance for `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, and `NMEM_SPACE`.

## [0.1.0] - 2026-03-31

### Added

- Initial release with five skills:
  - `read-working-memory`: Daily briefing with focus areas, priorities, and recent changes
  - `search-memory`: Semantic search across memories and past conversations
  - `distill-memory`: Save decisions, procedures, and insights as durable memories
  - `save-thread`: Structured handoff summaries for session continuity
  - `status`: Server connectivity check
- Behavioral guidance companion (`AGENTS.md`)
- Pi package manifest for `pi install npm:nowledge-mem-pi`
