# Changelog

## [Unreleased] - 2026-03-11

- **Explore Graph**: browse graph nodes directly from Raycast and inspect connected memories, entities, and relationships
- **Explore Connections**: jump from any memory result into a seeded graph neighborhood with `cmd-g`
- **Remote-aware graph access**: graph exploration now uses the shared HTTP `GET /graph/explore` endpoint instead of reconstructing neighborhoods client-side
- **Remote Working Memory**: the Working Memory command now reads from the Mem API, so remote Mem setups work correctly
- **Safer local editing contract**: `Edit Working Memory` now refuses remote connections and stays explicitly local-only
- **Remote auth support**: Raycast can now use `Server URL` + `API Key` preferences or `~/.nowledge-mem/config.json`

## [Initial Version] - {PR_MERGE_DATE}

- **Search Memories**: semantic search with relevance scoring, recent memories fallback
- **Add Memory**: save with title, content, and importance from Raycast
- **Working Memory**: rendered markdown view of your daily briefing
- **Edit Working Memory**: opens `~/ai-now/memory.md` in your default editor
- Copy Content and Copy Title actions on all memory items
- Deep link support to open memories in the Nowledge Mem desktop app
