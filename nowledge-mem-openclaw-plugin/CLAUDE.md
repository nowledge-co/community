# CLAUDE.md - Nowledge Mem OpenClaw Plugin

This file is a continuation guide for future sessions working on
`community/nowledge-mem-openclaw-plugin`.

## Scope

- Plugin target: OpenClaw plugin runtime
- Runtime: JS modules under `src/`, no TS build pipeline
- Memory backend: local `nmem` CLI (fallback `uvx --from nmem-cli nmem`)

## Current Status

- Core integration works for local-first memory operations.
- Config schema intentionally does **not** include `serverUrl` anymore.
- Recall hook injects memory context as central external memory guidance.

## Files That Matter

- `src/index.js`: plugin registration (tools/hooks/commands/cli)
- `src/client.js`: nmem command resolution + CLI wrappers
- `src/config.js`: strict config parsing (`autoRecall`, `autoCapture`, `maxRecallResults`)
- `src/hooks/recall.js`: `before_agent_start` context injection
- `src/hooks/capture.js`: `agent_end` capture behavior
- `src/tools/*.js`: exposed tool handlers
- `openclaw.plugin.json`: plugin metadata + config schema + UI hints
- `README.md`, `CHANGELOG.md`: docs

## Tool/Hook Surface

Tools currently implemented:

- `nowledge_mem_search`
- `nowledge_mem_store`
- `nowledge_mem_working_memory`

Hooks:

- `before_agent_start` (auto recall when enabled)
- `agent_end` (auto capture when enabled)

Commands:

- Slash commands in `src/commands/slash.js` (`/remember`, `/recall`)
- CLI registration in `src/commands/cli.js`

## Config Keys (authoritative)

- `autoRecall` (boolean, default `true`)
- `autoCapture` (boolean, default `false`)
- `maxRecallResults` (number, clamp 1-20, default `5`)

`serverUrl` was removed; plugin is CLI-driven.

## Local Smoke Commands

```bash
node --check src/index.js
node --check src/client.js
node -e "JSON.parse(require('fs').readFileSync('openclaw.plugin.json','utf8'));console.log('plugin json ok')"
nmem --version || uvx --from nmem-cli nmem --version
nmem --json m search "openclaw" -n 3
```

If linting is needed:

```bash
npm install
npm run lint
```

Note: repo formatting baseline may fail lint outside touched files.

## Known Constraints

- Current OpenClaw plugin surface is lighter than Alma plugin (fewer CRUD tools).
- Rich response normalization/error taxonomy is less mature than Alma `v0.2.x`.
- Tool-calling quality still depends on model behavior; recall hook helps but is not absolute.

## Recommended Next Improvements

1. Parity upgrade with Alma:
   - add `show/update/delete` for memories
   - add thread tools (`thread_search/show/create/delete`)
2. Normalize response contracts and structured error codes.
3. Add safer delete semantics (`force` false by default + idempotent notFound handling).
4. Add docs section with explicit tool input/output examples.

## Non-Goals / Avoid

- Do not reintroduce unused `serverUrl`.
- Do not add remote/cloud dependencies for core memory path.
- Do not silently accept unknown config keys (keep strict parser).
