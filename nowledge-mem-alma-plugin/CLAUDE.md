# CLAUDE.md - Nowledge Mem Alma Plugin

This file is a practical continuation guide for future agent sessions working on
`community/nowledge-mem-alma-plugin`.

## Scope

- Plugin target: Alma local plugin system
- Runtime: plain ESM (`main.js`), no build step
- Memory backend: `nmem` CLI (fallback: `uvx --from nmem-cli nmem`)

## Current Status (as of v0.6.0)

- Plugin is installed/activated and registers 11 tools successfully in Alma logs.
- Main unresolved UX issue is often chat tool allowlist/routing (session-level),
  not plugin registration.
- v0.6.0 adds: sourceThreadId linkage, structured save with unit_type + temporal fields,
  save dedup guard (>=90% similarity), thread pagination (offset/limit), thread source filter,
  behavioral guidance in recall injection.
- Tool contracts were normalized in recent passes:
  - search-style: `{ ok, type, query, total, items, raw }` — items may include `sourceThreadId`
  - singleton-style: `{ ok, item, ... }` — show includes `sourceThreadId` when available
  - store: `{ ok, item, summary }` or `{ ok, skipped, reason, existingId, similarity }`
  - delete-style: `{ ok, id, force, [cascade], notFound, item? }`
  - errors: `{ ok:false, error:{ code, operation, message } }`

## Files That Matter

- `main.js`: all logic (tool registration, hooks, nmem client, validation/error mapping)
- `manifest.json`: plugin metadata + contributed tools + settings schema
- `README.md`: user-facing behavior, response contract examples
- `alma-skill-nowledge-mem.md`: optional skill policy for better tool-calling
- `CHANGELOG.md`: versioned changes

## Tool Inventory

Registered IDs (plugin-qualified at runtime as `nowledge-mem.<id>`):

- `nowledge_mem_query`
- `nowledge_mem_search`
- `nowledge_mem_store`
- `nowledge_mem_show`
- `nowledge_mem_update`
- `nowledge_mem_delete`
- `nowledge_mem_working_memory`
- `nowledge_mem_thread_search`
- `nowledge_mem_thread_show`
- `nowledge_mem_thread_create`
- `nowledge_mem_thread_delete`

## Hooks

- `chat.message.willSend`: auto-recall injection
- Quit/deactivate auto-capture:
  - `app.willQuit`
  - `app.will-quit`
  - `app.beforeQuit`
  - `app.before-quit`
  - `deactivate()` fallback if quit hooks do not fire

## Settings (manifest + `context.settings`)

- `nowledgeMem.recallPolicy` (default `balanced_thread_once`)
- `nowledgeMem.autoCapture` (default `false`)
- `nowledgeMem.maxRecallResults` (default `5`, clamp 1-20)

## Ground Truth Debug Checklist

When user says "tools not visible/callable", do this before changing code:

1. Plugin API state:
   - `curl -s http://localhost:23001/api/plugins/nowledge-mem | jq`
2. Confirm `enabled: true`, expected `version`, and `manifest.contributes.tools`.
3. Confirm session tools attached to thread:
   - `curl -s http://localhost:23001/api/threads/<thread_id> | jq '.tools'`
4. If thread lacks `nowledge-mem.*`, this is often a chat mode/tool allowlist issue.
5. Check Alma logs (`scope_v3.json`) for:
   - `Registered tool: nowledge-mem.nowledge_mem_*`

Do not assume registration failed if ToolSearch can discover names.

## Local Smoke Commands

```bash
node --check main.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log('manifest ok')"
nmem --version || uvx --from nmem-cli nmem --version
nmem --json m search "alma" -n 3
nmem --json t search "alma" -n 3
```

## Reinstall / Reload in Alma

```bash
cp manifest.json main.js package.json README.md CHANGELOG.md alma-skill-nowledge-mem.md ~/.config/alma/plugins/nowledge-mem/
osascript -e 'tell application "Alma" to quit' || true
node -e "const fs=require('fs');const p=process.env.HOME+'/Library/Application Support/alma/plugin-cache';if(fs.existsSync(p))for(const f of fs.readdirSync(p))if(f.endsWith('.mjs'))fs.unlinkSync(p+'/'+f)"
open -a Alma
```

## Known Constraints

- Some chat sessions expose only a fixed builtin tool set (e.g., ToolSearch/Bash/etc.).
  In those sessions plugin tools are not callable even when plugin is enabled.
- Tool invocation quality depends on model routing. `nowledge_mem_query` exists to
  reduce multi-step ToolSearch loops.

## Key v0.6.0 Features

- **sourceThreadId**: Search/show/query results include thread provenance for distilled memories.
  The agent can chain `sourceThreadId` → `nowledge_mem_thread_show` for full conversation context.
- **Structured save**: `nowledge_mem_store` supports `unit_type`, `event_start`, `event_end`,
  `temporal_context` for richer knowledge graph nodes.
- **Save dedup**: Before saving, searches for near-identical existing memories. Blocks at >=90% similarity.
- **Thread pagination**: `nowledge_mem_thread_show` accepts `offset` for progressive retrieval.
  Returns `totalMessages`, `hasMore`, `returnedMessages` metadata.
- **Thread source filter**: `nowledge_mem_thread_search` accepts `source` to filter by platform.
- **Behavioral guidance**: Recall injection includes proactive save nudge + sourceThreadId awareness.

## Recommended Next Improvements

Only implement if needed; verify with runtime evidence first.

1. Add test fixture script to validate response shape per tool automatically.
2. Add explicit telemetry fields for hook outcomes (`recallUsed`, `captureSavedThreadId`) in logs.

## Non-Goals / Avoid

- Do not add external dependencies (keep plugin self-contained).
- Do not reintroduce plugin command/slash UX unless Alma API guarantees consistent behavior.
- Do not assume missing tool calls imply missing plugin registration.
