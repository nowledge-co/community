# Plugin Development Guide

> Rules and conventions for building Nowledge Mem integrations. Follow these when creating a new plugin or extending an existing one.

---

## Transport

Use `nmem` CLI as the universal fallback and the real transcript-import path. When a host can load package-bundled MCP servers and has a verified user/workspace override path, ship MCP as the direct retrieval/write layer too.

| Transport | When to use | Examples |
|-----------|------------|----------|
| **nmem CLI** | Agent plugins that can spawn subprocesses, especially for diagnostics, hooks, and real thread import | OpenClaw, Alma, Bub, Droid, Claude Code, Gemini CLI, Codex |
| **MCP** | Runtimes that natively speak MCP and can connect to the backend MCP server; bundle it only when remote/custom endpoint overrides are verified | Cursor, Codex, Gemini CLI |
| **HTTP API** | UI extensions where subprocess spawning is inappropriate | Raycast, browser extension |

**CLI resolution order:**
1. `nmem` on PATH
2. `uvx --from nmem-cli nmem` (auto-download fallback)

**Credential handling:**
- API key via `NMEM_API_KEY` environment variable only — never as a CLI argument or in logs
- API URL via `--api-url` flag or `NMEM_API_URL` environment variable
- Shared config file: `~/.nowledge-mem/config.json` (`apiUrl`, `apiKey`)
- For bundled MCP, default to the local desktop endpoint only when user/workspace MCP config can override the same server name. Do not ship a local-only MCP server into a plugin where remote users cannot cleanly override it.
- Direct HTTP MCP clients do not inherit the shared config file. User-facing remote docs should point to `nmem config mcp show --host <host>` so users paste a host-owned MCP block with the same URL/key instead of editing package files.

**Transcript boundary:**
- Real transcript save runs beside the host session files. Use `nmem t save --from <runtime>` or a host SDK capture path on the client machine, then upload through API create/append.
- Do not expose transcript capture as an MCP tool. MCP may search/read saved threads, but local transcript discovery belongs to `nmem` or the host-native capture path.

## Space-aware execution

Spaces are optional. Treat them as ambient context, not required setup.

- If the host/runtime has a real ambient lane, pass it through:
  - Host/plugin config first: `space`, `spaceTemplate`, `space_by_identity`, or the platform's own equivalent
  - CLI fallback: `nmem ... --space "<space name>"` or ambient `NMEM_SPACE="<space name>"`
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
- For CLI-first hosts, prefer one ambient session lane via `NMEM_SPACE` only when the whole session naturally belongs to one space and the host has no better native config surface. Legacy `NMEM_SPACE_ID` remains compatibility-only. Use per-call `--space` when only some actions need an override.
- The host should not make up a new space just because a prompt mentions a new topic.
- If a space profile includes instructions, retrieval mode, or shared-space links, treat those as lane defaults. They should influence retrieval behavior, not replace the user's own instructions.

### Mapping levels

Different hosts can support different levels of space routing. Keep the abstraction honest:

- `fixed lane`
  - One profile or process always belongs to one space.
  - Example config: `space = "Research Agent"`. Use `NMEM_SPACE="Research Agent"` only when the host is CLI-first and lacks a richer config surface.
- `derived lane`
  - The host exposes a trustworthy identity or workspace signal and the plugin derives the space from it.
  - Example config: `spaceTemplate = "agent-${AGENT_NAME}"` or Hermes `space_template = "agent-{identity}"`.
- `explicit map`
  - The host exposes a stable identity and the plugin can map a small known set of identities to named spaces.
  - Example config: `space_by_identity = {"research":"Research Agent","ops":"Operations Agent"}`.

If the runtime does not expose identity cleanly, do not fake per-agent mapping. Stay with one fixed lane per profile/process or use `Default`.

### Space profile semantics

- `defaultRetrievalMode=strict`: automatic recall stays inside the active space.
- `defaultRetrievalMode=shared`: automatic recall starts in the active space, then also searches the listed shared spaces.
- `defaultRetrievalMode=all`: automatic recall can search across the whole memory graph by default.
- `sharedSpaceIds`: retrieval-only links. They do not change where new memories, threads, or sources are stored.
- `instructions`: lane-specific guidance for AI Now and built-in/background agents. Plugins should not reinterpret this as a second system prompt owned by the host.

### Resolution order

When a host supports multiple ways to choose a lane, prefer one clear precedence chain:

1. explicit tool-call override
2. plugin/provider config (for example `space`, `space_by_identity`, or `space_template`)
3. session env/context such as `NMEM_SPACE`
4. `Default`

Humans should usually work with the visible space name. Only storage and compatibility surfaces need the hidden key.

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

## User override model

Users need a customization path that survives updates.

### Rules

1. **Never require edits inside the installed plugin directory.**
   - Do not tell users to patch bundled skills, hooks, scripts, or packaged `AGENTS.md` files under a marketplace cache or plugin install root.
2. **Prefer the host's own instruction surface.**
   - Project `AGENTS.md`
   - `CLAUDE.local.md` / `CLAUDE.md`
   - `.github/instructions/*.instructions.md`
   - `.cursor/rules/*.mdc`
   - `GEMINI.md`
   - `HERMES.md` / `SOUL.md`
3. **Document the honest fallback when no such surface exists.**
   - If the host only exposes config toggles or a custom system prompt field, say that directly.
   - Do not invent a pseudo-standard filename the host will not load.

### Packaging guidance

- Bundled behavioral files inside a package are **reference defaults**.
- README files should include a short `Customize without forking` section whenever the host has a real override-capable abstraction.
- If the host supports both shared and personal instruction layers, explain both:
  - shared/team rule file
  - personal/local rule file
- If the host does not support a first-class rule file, point users to host config or system prompt customization instead.

For the current host mapping, see [`USER_OVERRIDE_GUIDE.md`](./USER_OVERRIDE_GUIDE.md).

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
- [ ] **Pre-compaction capture** — when the host exposes a pre-compression hook and a real transcript path, save the thread before context is compressed
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

### Compaction boundary rule

Treat compaction as a possible data-loss boundary.

- If the host provides both a pre-compaction/pre-compression hook and a transcript path, register capture there as well as at normal session end.
- If the host only provides post-compaction recovery, use it for Working Memory reload and recall, but do not describe that as pre-compaction transcript capture.
- If the host does not expose a transcript-backed importer, use `save-handoff` language. Do not imply a hook can preserve the full thread.
- Pre-compaction capture should be idempotent and should pass the host session id and working directory through to `nmem` or the plugin capture API.

---

## Registry Checklist

When shipping a new integration:

1. [ ] Add entry to `community/integrations.json` — **always update the registry first**
2. [ ] Align behavioral guidance with `community/shared/behavioral-guidance.md`
3. [ ] Use `nowledge_mem_*` tool naming (or document platform convention)
4. [ ] Update `community/README.md` integration table
5. [ ] Verify `nowledge-labs-website/nowledge-mem/data/integrations.ts` alignment
6. [ ] Add marketplace entry if applicable (`.claude-plugin/`, `.github/plugin/`, `.cursor-plugin/`, `.factory-plugin/`)
7. [ ] Update `nowledge-mem-npx-skills/skills/check-integration/SKILL.md` detection table
8. [ ] Add integration docs page to website (EN + ZH)

When bumping a plugin **version**:

1. [ ] Update `version` field in `community/integrations.json`
2. [ ] Verify `nowledge-labs-website/nowledge-mem/data/integrations.ts` alignment
3. [ ] Add marketplace entry version bump if applicable

### Host-specific marketplace files

Do not assume one marketplace file serves every host correctly.

- Claude Code reads `.claude-plugin/marketplace.json`.
- GitHub Copilot CLI reads `.github/plugin/marketplace.json` and also accepts `.claude-plugin/marketplace.json` for compatibility.
- When the same plugin name should install different host-specific packages, keep separate marketplace files so each host resolves the name to its own package.
- Validate that each marketplace source points at the host-specific directory, not a similarly named package for another runtime.

### Runtime Consumers

The registry is fetched at runtime by multiple consumers. Changes to schema or field
names affect all of them:

| Consumer | How it reads | What it uses |
|----------|-------------|-------------|
| Desktop app (Tauri) | `fetch_plugin_registry` command — fetches from GitHub, caches to disk | `id`, `name`, `version` for update awareness |
| `nmem plugins check` CLI | Direct `httpx.get()` — fetches from GitHub, caches to `~/.nowledge-mem/` | `id`, `name`, `version` for update awareness |
| `check-integration` npx skill | Reads detection hints at skill invocation time | `install.command`, `install.docsUrl`, detection hints |
| Website `integrations.ts` | Manually synced (not auto-fetched) | All fields for the integrations showcase page |
