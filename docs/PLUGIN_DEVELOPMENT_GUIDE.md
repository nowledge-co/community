# Plugin Development Guide

> Rules and conventions for building Nowledge Mem integrations. Follow these when creating a new plugin or extending an existing one.

---

## Transport

Use `nmem` CLI as the execution layer for memory operations.

| Transport | When to use | Examples |
|-----------|------------|----------|
| **nmem CLI** | Agent plugins that can spawn subprocesses | OpenClaw, Alma, Bub, Droid, Claude Code, Gemini CLI |
| **MCP** | Declarative runtimes that natively speak MCP and connect to the backend MCP server | Cursor |
| **HTTP API** | UI extensions where subprocess spawning is inappropriate | Raycast, browser extension |

**CLI resolution order:**
1. `nmem` on PATH
2. `uvx --from nmem-cli nmem` (auto-download fallback)

**Credential handling:**
- API key via `NMEM_API_KEY` environment variable only — never as a CLI argument or in logs
- API URL via `--api-url` flag or `NMEM_API_URL` environment variable
- Shared config file: `~/.nowledge-mem/config.json` (`apiUrl`, `apiKey`)

## Space-aware execution

Spaces are optional. Treat them as ambient context, not required setup.

- If the host/runtime has a real ambient lane, pass it through:
  - CLI: `nmem ... --space "<space name>"` or ambient `NMEM_SPACE="<space name>"`
  - MCP: `space_id`
  - HTTP API: `space_id`
- If the host has no natural ambient lane, keep using the default space and stay silent about spaces in the default UX.
- Do not invent a second “vault”, “project memory”, or “tenant” abstraction on top of `space_id`.
- Cross-space retrieval should be explicit. Do not silently mix a shared lane into the default recall path.
- Provisioning the roster is now a first-class shared surface:
  - CLI: `nmem spaces ...`
  - HTTP API: `/spaces`
- The old local file `~/ai-now/memory.md` is only the Default-space compatibility path. Treat it as a fallback, not as the canonical model for every space.
- The host should derive ambient space from context it already owns, such as:
  - workspace or project path
  - agent identity / persona slot
  - selected project or repository
  - explicit user choice in the host UI
- For CLI-first hosts, prefer one ambient session lane via `NMEM_SPACE` when the whole session naturally belongs to one space. Legacy `NMEM_SPACE_ID` remains compatibility-only. Use per-call `--space` when only some actions need an override.
- The host should not make up a new space just because a prompt mentions a new topic.
- If a space profile includes instructions, retrieval mode, or shared-space links, treat those as lane defaults. They should influence retrieval behavior, not replace the user's own instructions.

---

## Tool Naming

### Canonical convention

New tools should use the **`nowledge_mem_<action>`** prefix (underscore-separated).

### Platform exceptions

Some platforms have strong naming conventions that take precedence:

| Platform | Convention | Reason |
|----------|-----------|--------|
| Bub | `mem.<action>` | Bub dot-namespace convention |
| OpenClaw | `memory_<action>` for memory-slot tools | OpenClaw memory slot convention |
| MCP backend | `memory_<action>` | Backend-defined tool surface |

### Rules

1. **Never rename a published tool name.** If alignment is needed, add the new name as an alias and deprecate the old one gradually.
2. **Document the naming convention** in `integrations.json` under `toolNaming`.
3. **New plugins** should use `nowledge_mem_<action>` unless the platform has a documented naming convention.

---

## Skill Alignment

### Reference the shared behavioral guidance

All behavioral heuristics (when to search, when to save, when to read Working Memory) should align with `community/shared/behavioral-guidance.md`.

**Platform-specific additions** (MCP tool names for Cursor, Context Engine details for OpenClaw, Bub comma commands) are kept separate from the shared heuristics.

### Skill naming

Skill names use kebab-case and are consistent across all plugins:

| Skill | Purpose |
|-------|---------|
| `read-working-memory` | Load daily briefing at session start |
| `search-memory` | Proactive recall across memories and threads |
| `distill-memory` | Capture decisions, insights, and learnings |
| `save-handoff` | Structured resumable summary (when no real thread importer exists) |
| `save-thread` | Real session capture (only when supported) |
| `check-integration` | Detect agent, verify setup, guide plugin installation |
| `status` | Connection and configuration diagnostics |

### Autonomous save is required

Every integration's distill/save guidance MUST include proactive save encouragement:

> Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.

---

## Capabilities Checklist

Every integration should provide at minimum:

- [ ] **Working Memory read** — load daily briefing at session start
- [ ] **Search** — proactive recall across memories, with thread fallback
- [ ] **Distill** — save decisions and insights (with autonomous save encouragement)
- [ ] **Status** — connection and configuration diagnostics

Optional capabilities (require platform support):

- [ ] **Auto-recall** — inject relevant memories before each response
- [ ] **Auto-capture** — save session as searchable thread at session end
- [ ] **Graph exploration** — connections, evolution chains, entity relationships
- [ ] **Thread save** — real transcript import (only if parser exists)
- [ ] **Slash commands** — quick access to common operations
- [ ] **Space profile support** — can pass one ambient space name, and can optionally provision/show spaces when the host has a real multi-lane workflow

---

## Thread Save Decision

Before adding thread save to a new integration:

1. **Does `nmem t save --from <runtime>` already have a parser?** If yes → delegate to CLI (Tier 1)
2. **Can the plugin capture the session via lifecycle hooks?** If yes → implement plugin-level capture (Tier 2)
3. **Neither?** → Use `save-handoff` and be honest about it (Tier 3)

**Never fake `save-thread`** in a runtime that doesn't support real transcript import.

---

## Registry Checklist

When shipping a new integration:

1. [ ] Add entry to `community/integrations.json` — **always update the registry first**
2. [ ] Align behavioral guidance with `community/shared/behavioral-guidance.md`
3. [ ] Use `nowledge_mem_*` tool naming (or document platform convention)
4. [ ] Update `community/README.md` integration table
5. [ ] Verify `nowledge-labs-website/nowledge-mem/data/integrations.ts` alignment
6. [ ] Add marketplace entry if applicable (`.claude-plugin/`, `.cursor-plugin/`, `.factory-plugin/`)
7. [ ] Update `nowledge-mem-npx-skills/skills/check-integration/SKILL.md` detection table
8. [ ] Add integration docs page to website (EN + ZH)

When bumping a plugin **version**:

1. [ ] Update `version` field in `community/integrations.json`
2. [ ] Verify `nowledge-labs-website/nowledge-mem/data/integrations.ts` alignment
3. [ ] Add marketplace entry version bump if applicable

### Runtime Consumers

The registry is fetched at runtime by multiple consumers. Changes to schema or field
names affect all of them:

| Consumer | How it reads | What it uses |
|----------|-------------|-------------|
| Desktop app (Tauri) | `fetch_plugin_registry` command — fetches from GitHub, caches to disk | `id`, `name`, `version` for update awareness |
| `nmem plugins check` CLI | Direct `httpx.get()` — fetches from GitHub, caches to `~/.nowledge-mem/` | `id`, `name`, `version` for update awareness |
| `check-integration` npx skill | Reads detection hints at skill invocation time | `install.command`, `install.docsUrl`, detection hints |
| Website `integrations.ts` | Manually synced (not auto-fetched) | All fields for the integrations showcase page |
