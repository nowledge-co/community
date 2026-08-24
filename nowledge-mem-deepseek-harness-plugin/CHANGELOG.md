# Changelog

## 0.1.4

- Flushes DSH write-behind session persistence before exporting a completed
  turn, while keeping Mem capture fail-open when the host storage backend is
  unavailable.
- Detects the Context Bundle from DSH's model-visible derived message surface,
  so compaction can re-inject it when the prior snapshot is no longer visible.

## 0.1.3

- Makes the sandbox-unavailable `danger-full-access` retry fail closed unless
  the plugin explicitly opts in and the DSH host resolves the policy.
- Keeps the imported thread title session-scoped across incremental batches and
  rebuilds reconciliation arguments from the full payload.
- Turn-end capture now imports only events after the last acknowledged DSH
  sequence, stamps stable message external IDs, and replays safely after event
  compaction or a failed write.
- Prompt-time recall no longer fires on a bare continuation prompt such as
  "continue" or "继续". Since the prompt is also the search query, recalling on
  a content-free continuation could surface unrelated memories.

## 0.1.2

- Omits unset MCP auth and identity headers so DSH boots cleanly with a local unauthenticated Nowledge Mem server.
- Guards `nmem` shell calls and retries Windows sandbox-unavailable failures with an explicit `danger-full-access` policy instead of rejecting DSH event listeners.

## 0.1.1

- Marks DeepSeek Harness runtime packages as optional peers so `pnpm` does not try to fetch unpublished DSH internals during GitHub or tarball install.

## 0.1.0

- Initial community DeepSeek Harness bundle.
- Adds native Context Bundle injection, prompt-time recall, Mem MCP tools, and turn-end DSH transcript import.
