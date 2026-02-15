# Changelog

## 0.1.3

- Remove runtime `zod` dependency to fix Alma "Cannot find package 'zod'" plugin load error
- Replace tool schemas with plain JSON-schema objects and keep strict runtime input validation

## 0.1.2

- Add central-memory bridge mode via `chat.message.willSend` context injection
- Add chat/settings permissions and plugin configuration metadata
- Improve prompt steering to prioritize Nowledge Mem as external memory system

## 0.1.1

- Fix Alma `manifest.json` validation issues for local plugin install
- Normalize command IDs to `nowledge-mem.*` manifest convention
- Update README with explicit local plugin path install instructions

## 0.1.0

- Initial Alma plugin release
- Added 3 tools: search, store, and working memory
- Added command palette actions for status/search/save/read-thread
- Added optional auto-recall and auto-capture hooks
