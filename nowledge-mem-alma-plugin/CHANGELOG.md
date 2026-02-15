# Changelog

## 0.2.13

- Improve quit auto-capture reliability by listening to `app.before-quit`/`app.beforeQuit` in addition to existing quit events
- Add `deactivate()` fallback capture when autoCapture is enabled and quit hook did not fire

## 0.2.12

- Fix quit event mismatch: listen to both `app.willQuit` and `app.will-quit`

## 0.2.11

- Fix auto-capture persistence bug: remove invalid `nmem t save --from alma` usage
- Auto-capture now serializes active Alma messages and persists via `nmem t create ... -s alma`
- Improve auto-capture skip reasons for clearer runtime logs

## 0.2.10

- Remove plugin command/slash surface (`searchAndIngest`, `clearStagedIngest`) for a cleaner UX
- Remove command registration permission and related staged-ingest runtime paths
- Keep integration focused on tools + recall/capture hooks

## 0.2.9

- Remove clipboard/input dependency from `Search and Ingest` (runtime-incompatible in current Alma API surface)
- Keep single-layer flow: query -> multi-select -> staged for next send
- Add explicit staged preview notification after selection

## 0.2.8

- Simplify `Search and Ingest` UX to single-layer flow: query -> multi-select -> copy
- Remove post-selection action picker to reduce friction
- Keep selected items staged for next send after successful copy

## 0.2.7

- Improve `Search and Ingest` UX with multi-selection support and clearer two-step flow
- Add explicit post-selection actions: stage for next send, copy to clipboard, insert into input (with clipboard fallback)
- Add stronger selection summary notifications to reduce confusion after selection

## 0.2.6

- Simplify configuration surface with single `nowledgeMem.recallPolicy` setting
- Keep runtime backward compatibility for legacy recall settings (`autoRecall`, `autoRecallMode`, `recallFrequency`)
- Add command-driven staged ingest flow (`Nowledge Mem: Search and Ingest`) for chat session context injection
- Add command to clear staged ingest per thread
- Continue including compact `nmem` CLI playbook in balanced recall mode for Bash fallback flows

## 0.2.5

- Add `nowledgeMem.recallFrequency` (`thread_once` / `every_message`) for controllable recall injection cadence
- Add `nowledgeMem.injectCliPlaybook` to include compact `nmem` fallback guidance in injected context
- Extend startup logging with effective recall policy details
- Update README policy matrix and examples for tool-hidden chat sessions

## 0.2.4

- Add explicit injected-context metadata in auto-recall block to reduce ambiguity vs live tool calls
- Add `nowledgeMem.autoRecallMode` setting with `balanced` and `strict-tools` policies
- In `strict-tools`, disable recall injection intentionally and log policy resolution at startup
- Improve configuration descriptions and add policy matrix/examples in README

## 0.2.3

- Standardize validation failures as structured errors (`validation_error`) instead of thrown exceptions
- Expand CLI error classification with `model_unavailable`
- Add explicit error-code documentation and quick input/output examples in README

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
