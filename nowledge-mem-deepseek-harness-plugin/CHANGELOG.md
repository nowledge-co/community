# Changelog

## 0.1.2

- Omits unset MCP auth and identity headers so DSH boots cleanly with a local unauthenticated Nowledge Mem server.
- Guards `nmem` shell calls and retries Windows sandbox-unavailable failures with an explicit `danger-full-access` policy instead of rejecting DSH event listeners.

## 0.1.1

- Marks DeepSeek Harness runtime packages as optional peers so `pnpm` does not try to fetch unpublished DSH internals during GitHub or tarball install.

## 0.1.0

- Initial community DeepSeek Harness bundle.
- Adds native Context Bundle injection, prompt-time recall, Mem MCP tools, and turn-end DSH transcript import.
