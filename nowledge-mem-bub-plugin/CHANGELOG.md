# Changelog

## 0.2.1 (2026-03-23)

- Changed: strengthened autonomous save guidance in system prompt to align with shared behavioral guidance across all Nowledge Mem integrations.
- Changed: updated token budget comment (~50 → ~70 tokens) to match actual guidance length.

## 0.2.0 (2026-03-17)

- Fixed: memory context (Working Memory + recalled knowledge) no longer injected into system prompt, which was breaking LLM prefix cache and causing full KV recomputation every turn. Context now injected via `build_prompt` hook into user prompt space. System prompt stays static and cacheable. Contributed by @frostming.
- Fixed: trailing slash in API URL no longer causes silent 404 — URLs like `https://mem.example.com/` are now normalized at config load time.
- Changed: `system_prompt` hook now returns only static behavioral guidance (identical every turn), preserving prefix cache.
- Changed: memory loading moved from `load_state` hook to private `_load_memory` method called from `build_prompt`.
- Changed: skill directory renamed from `bub_skills/` to `skills/` for consistency.

## 0.1.2 (2026-03-12)

- Fixed: nmem cli argument issue by @ferstar via https://github.com/nowledge-co/community/pull/118

## 0.1.1 (2026-03-12)

- Fixed: broad `NmemError` catch in `save_state` no longer causes double timeout (up to 30s) when nmem is unreachable — only retries on "not found" errors, and caches thread existence after first success
- Fixed: `bub_skills` package now includes `__init__.py` so bub can discover the bundled skill via `importlib`
- Removed: unused `get_memory` method from client

## 0.1.0 (2026-03-12)

Initial release — brings cross-tool knowledge into Bub.

- 9 tools (`mem.search`, `mem.save`, `mem.context`, `mem.connections`, `mem.timeline`, `mem.forget`, `mem.threads`, `mem.thread`, `mem.status`) for searching and saving knowledge across all your AI tools
- Hook-based integration: behavioural guidance via `system_prompt`, optional Working Memory injection via `load_state`, incremental thread capture via `save_state`
- Two modes: default (agent-driven, on-demand) and session context (auto-inject Working Memory + recalled knowledge each turn)
- Conversations in Bub flow into Nowledge Mem so other tools can find them
- Pre-save deduplication check
- Bundled `nowledge-mem` skill for agent self-guidance
- Access Anywhere support via `~/.nowledge-mem/config.json` or `NMEM_API_URL` / `NMEM_API_KEY`
