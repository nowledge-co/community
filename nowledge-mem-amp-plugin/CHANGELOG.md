# Changelog

## [Unreleased]

### Fixed

- Stop writing `connector loaded`/`connector disposed` lifecycle messages to the
  plugin's stderr by default. Amp's host logs any plugin stderr output as WARN
  (`Plugin stderr`), which surfaced these routine messages as log noise. The
  lifecycle messages now require `NMEM_AMP_DEBUG` to be set to any recognized
  truthy value (`1`/`true`/`on`/`yes`).

## [0.1.2] - 2026-08-12

### Fixed

- Capture automatic `agent.end` turns from Amp's event payload instead of
  reading the full thread transcript on every turn.
- Preserve all pending incremental turn batches while debounce or another
  capture is in flight.
- Read Amp transcripts from the start in pages so captures include messages
  beyond the SDK's default trailing page during manual full-session saves.
- Append to canonical threads when the server reports an existing thread as
  either `409 Conflict` or an explicit `422` already-exists response.
- Allow up to two minutes for large thread uploads before timing out.

## [0.1.1] - 2026-08-10

### Fixed

- Restored the Amp-discoverable root plugin entry at `plugins/nowledge-mem.ts`
  during install and update. Existing `0.1.0` installs may have copied the
  bundle without the root entry, so Amp could miss the plugin.
- Hardened install rollback so failed updates preserve the previous entry,
  bundle, and skill, and failed first installs do not leave a partial Amp
  plugin behind.

## [0.1.0] - 2026-08-08

### Added

- Amp plugin connecting to the Nowledge Mem knowledge graph, loaded via Amp's `@ampcode/plugin` plugin system.
- Ten registered tools (`nowledge_mem_*`): Context Bundle, Working Memory, search, save, update, thread search, save thread, save handoff, graph expand, status.
- Automatic session capture on the Amp `agent.end` event: reads the full transcript through Amp's thread API and posts it to Nowledge Mem's thread API over HTTP, with debounce, in-flight coalescing, and signature-based deduplication.
- Context Bundle bootstrap on the Amp `agent.start` event: injects a compact startup context as a hidden message so the agent starts every turn aware of its identity, space, rules, and Working Memory. Fail-open; disable with `NMEM_AMP_BOOTSTRAP=0`.
- Knowledge graph expansion tool (`nowledge_mem_graph_expand`): returns the neighbourhood of a memory with directed, labelled edges, backed by `nmem graph expand`.
- Three command-palette entries: `nowledge-mem:status`, `nowledge-mem:save-thread`, `nowledge-mem:search`.
- Amp-native skill (`nowledge-mem`) carrying behavioral guidance.
- `scripts/install.sh` for one-step install and update into `~/.config/amp/plugins/` and `~/.config/amp/skills/`.
- Local and remote Nowledge Mem support via shared `~/.nowledge-mem/config.json` and `NMEM_*` environment variables.
- Ambient space and AI Identity support through `NMEM_SPACE`, `NMEM_AGENT_ID`, and `NMEM_HOST_AGENT_ID`.
- Full TypeScript type annotations, docstrings on public members, and a Vitest unit-test suite with 100% line and branch coverage.

### Changed

- Message converter tightened to Amp's documented `Thread*Block` union (`text`, `thinking`, `tool_use`, `tool_result`); removed speculative part types (`file`, `patch`, structural markers) that the Amp SDK does not define.
