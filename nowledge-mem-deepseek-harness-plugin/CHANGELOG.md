# Changelog

## 0.1.3

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
