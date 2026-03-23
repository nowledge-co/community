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

1. [ ] Add entry to `community/integrations.json`
2. [ ] Align behavioral guidance with `community/shared/behavioral-guidance.md`
3. [ ] Use `nowledge_mem_*` tool naming (or document platform convention)
4. [ ] Update `community/README.md` integration table
5. [ ] Verify `nowledge-labs-website/nowledge-mem/data/integrations.ts` alignment
6. [ ] Add marketplace entry if applicable (`.claude-plugin/`, `.cursor-plugin/`, `.factory-plugin/`)
7. [ ] Update `nowledge-mem-npx-skills/skills/check-integration/SKILL.md` detection table
8. [ ] Add integration docs page to website (EN + ZH)
