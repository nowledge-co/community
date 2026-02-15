# Changelog

## 0.2.2

- Normalize tool outputs to stable shapes (`ok/query/total/items` or `ok/item`)
- Add structured CLI error mapping (`nmem_not_found`, `not_found`, `permission_denied`, `cli_error`)
- Make delete defaults safer (`force: false` for memory/thread delete)
- Add update validation requiring at least one field change
- Add thread create validation requiring `content` or `messages`

## 0.2.1

- Add `nowledge_mem_query` one-shot tool to reduce ToolSearch-only loops
- Strengthen auto-recall instruction with fully-qualified tool ids (`nowledge-mem.*`)

## 0.2.0

- Add full on-demand memory tools: `show`, `update`, `delete` in addition to search/store
- Add on-demand thread tools: `thread_search`, `thread_show`, `thread_create`, `thread_delete`
- Extend search/store arguments with filters/labels/source for richer tool-driven flows

## 0.1.4

- Remove modal command integrations and switch to chat-native flow (tools + hooks only)
- Remove command contributions from manifest to avoid slash/input popups
- Keep auto-recall and auto-capture behavior as the primary UX

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
