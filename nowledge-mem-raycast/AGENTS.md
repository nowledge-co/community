# AGENTS.md — nowledge-mem-raycast

This file is local to `community/nowledge-mem-raycast`.
Do not treat it as a replacement for the repository root `AGENTS.md`.

## Scope

- Primary folder: `community/nowledge-mem-raycast/`
- Related OpenClaw memory provider code: `community/nowledge-mem-openclaw-plugin/`
- Related design docs (parent repo):
  - `docs/design/OPENCLAW_MEMORY_PROVIDER_DESIGN.md`
  - `docs/implementation/OPENCLAW_MEMORY_PROVIDER_E2E_VALIDATION.md`
  - `docs/V06_VISION_AND_ROADMAP.md`

## OpenClaw Memory Provider Invariants

When `plugins.slots.memory = "nowledge-mem"`:

1. `memory_search` and `memory_get` must remain fully compatible with OpenClaw memory tooling.
2. Capture lifecycle must stay append-first and idempotent across:
   - `agent_end`
   - `after_compaction`
   - `before_reset`
3. Thread metadata integrity must be preserved (`external_id`, session/source fields).
4. `memory_get` must support:
   - `nowledgemem://memory/<id>`
   - raw memory IDs
   - `MEMORY.md` / `memory.md` alias mapped to Working Memory.
5. Retrieval remains tool-native (BM25/semantic); filesystem grep parity is optional, not required.

## Regression Command (Local-first)

Run this before merges that may impact memory-provider behavior:

```bash
node ../../nowledge-graph-py/scripts/validate_openclaw_memory_local.mjs
```

Optional:

```bash
node ../../nowledge-graph-py/scripts/validate_openclaw_memory_local.mjs --keep-data
```

The expected success marker is:

```text
[RESULT] PASS - OpenClaw memory provider local validation succeeded
```

## Maintenance Requirements

1. Keep validator script and docs in sync when tool contracts or lifecycle behavior changes.
2. If OpenClaw plugin hook semantics change, update:
   - `docs/design/OPENCLAW_MEMORY_PROVIDER_DESIGN.md`
   - validator scenarios
   - plugin implementation
3. If nmem CLI/API contracts change (`t append`, `t create --id`, idempotency), refresh fallback handling and rerun full validation.

## v0.6 Alignment

Provider design should reinforce `docs/V06_VISION_AND_ROADMAP.md` goals:

1. Cross-tool continuity of memory.
2. Local-first trust and transparency.
3. Strong lifecycle reliability so memory survives compaction/reset cycles.
4. Compatibility with advanced memory surfaces (Working Memory, graph-native systems, proactive features).

## Reality Check

"100% usage without drawback" is a target, not a literal guarantee.
Practical quality bar is:

1. Explicit invariants.
2. Automated regression.
3. Documented limits.
4. Fast bug-fix loop with source-verified behavior.
