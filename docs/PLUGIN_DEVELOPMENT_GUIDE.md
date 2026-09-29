# Plugin Development Guide

> Rules and conventions for building Nowledge Mem integrations. Follow these when creating a new plugin or extending an existing one.

---

## Start with the host contract

Before creating a package, record what the host actually provides: install
surface, MCP support, local command execution, lifecycle events, exact session
ID, transcript path or structured messages, transcript flush timing, delegated
agent identity, and a user-owned configuration override. Verify these against
the host's current API and a real session. A skill or MCP connection alone does
not grant transcript access.

Choose the smallest honest integration:

1. Use a dedicated host plugin when native hooks, transcript access, or a
   marketplace install are available. Use the portable Agent Plugins package
   only when the host has no better dedicated connector.
2. Add MCP for Memory search and writes when the host supports a user-owned
   endpoint configuration. Keep transcript capture on the client machine.
3. For file-backed sessions, register a transcript parser before claiming
   automatic Thread capture. For SDK message streams, use the existing
   acknowledged incremental import path. With neither source, offer a handoff
   skill instead of a simulated full Thread.
4. Prefer the shared CLI capture queue for lifecycle events. The plugin owns
   host-specific event mapping, privacy, process launch, and response handling;
   it must not implement another capture scheduler or persistence queue.

`nmem hook capture` is still release-gated. Do not require it from a published
plugin until the CLI version containing it is available to users and the
plugin declares that minimum version or retains an older-CLI fallback.

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

### File-backed lifecycle capture

After the CLI release gate above, a host command hook can pass one bounded JSON
observation to `nmem hook capture` on stdin. Use normalized v1 input when a
small adapter already extracts host fields; use `--input-format host-json` plus
RFC 6901 pointers when the host can launch a command with its JSON event on
stdin. Never pass transcript bodies, credentials, or an entire vendor event in
the normalized observation. A normalized observation is one JSON object of at
most 16 KiB:

```json
{
  "version": 1,
  "event": "session_end",
  "source_app": "registered-source",
  "session_id": "stable-host-session-id",
  "project": "/absolute/project/path",
  "transcript_path": "/absolute/transcript/path",
  "strategy": "current"
}
```

`source_app` and `session_id` are required. `source_app` must have a registered
session parser; `event` is one of `stop`, `turn_end`, `pre_compact`,
`session_end`, `session_switch`, `subagent_end`, or `interrupt`. `project`
defaults to the hook process's working directory. `strategy` is `current`
(default) or `sync`; `all_projects: true` requires `sync`. Optional routing
fields are `space` or `space_id` (mutually exclusive), `agent_id`, and
`host_agent_id`. Do not put message bodies or vendor-private fields in this
object. Example host-json command arguments:

```text
nmem hook capture --input-format host-json --from <registered-source> \
  --event session_end --session-id-pointer /session/id \
  --transcript-path-pointer /session/transcript_path
```

Host-json input may be at most 256 KiB; the CLI extracts only the configured
string fields and discards the rest. The session ID pointer must resolve to a
non-empty string. Supply `--project-pointer` when the payload contains the
project directory, and `--strategy sync --all-projects` only when that matches
the host's session model. Missing required pointers are rejected.

Replace every placeholder with values verified against the host payload and
the registered parser. Pass explicit `--space`/`--space-id` and `--agent-id`
only when the host has a trustworthy mapping; never derive them from a git
directory name. Map subagent events to their own session identity or suppress
them according to the host's real transcript model. Trigger after the
transcript is flushed, and at pre-compaction when the host offers that event.

The command's stdout is a Mem acknowledgement, **not** a host hook response.
Parse one JSON object and distinguish `enqueued` (durable local queue
acceptance, not completed upload), `skipped` (capture disabled), and `rejected`
(nonzero exit with a reason). Recognized `hook capture` argument errors also
return `rejected`; `--help`/`--version`, missing binaries, and malformed
top-level invocations are not acknowledgements. Treat absent, malformed, or
unknown output as failure. Log enough to diagnose it without logging the
transcript or credentials; fail open for the host turn only when the host's
hook contract requires that behavior. Do not silently fall back to a full
synchronous import.

Before publishing, exercise the real host with both normalized and host-json
observations where applicable: equivalent queue routing, one acknowledgement,
invalid flag and missing-pointer rejection, disabled capture without a queue
write, delayed transcript flush, CLI absent/older than the minimum, API outage,
and Windows/macOS/Linux launch paths the host supports. Verify the resulting
Thread in Mem, not just the hook process exit status. Keep a compatible
`nmem t capture` path until the minimum CLI is actually shipped.

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
  - AI Identity / persona slot
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

> Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked.

---

## User override model

Users need a customization path that survives updates.

### Rules

1. **Never require edits inside the installed plugin directory.**
   - Do not tell users to patch bundled skills, hooks, scripts, or packaged `AGENTS.md` files under a marketplace cache or plugin install root.
2. **Prefer the host's own instruction surface.**
   - Project `AGENTS.md`
   - `CLAUDE.local.md` / `CLAUDE.md`
   - `.github/copilot-instructions.md` or `.github/instructions/*.instructions.md`
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

## Integration Testing

Use `tests/plugin_e2e` for the key plugin smoke path. The static tests are
cheap and should pass without credentials:

```bash
uv run --with pytest pytest tests/plugin_e2e -q
```

Before release, run live host smoke for any key plugin you changed:

```bash
NMEM_PLUGIN_E2E=1 NMEM_PLUGIN_E2E_HOSTS=claude,codex,openclaw,hermes \
  uv run --with pytest pytest tests/plugin_e2e -q
```

Live smoke must prove user-visible behavior through Mem state, not just command
success. The harness sends a unique marker through the host, then verifies a
saved thread in a temporary Mem space.

Rules for adding live coverage:

- Do not pass Mem API keys as command-line arguments. Use `NMEM_API_KEY`,
  `NMEM_E2E_API_KEY`, or shared `nmem config client` state.
- Prefer a dedicated temporary space and delete it at teardown.
- Assert through `nmem t search` / `nmem t show` so the test covers capture,
  upload, indexing, and source metadata.
- Keep LLM provider/model selection configurable by env. The repo must not
  hard-code paid provider secrets or expensive default models.
- If a host lacks real lifecycle hooks, test the honest fallback surface instead
  of pretending it has automatic thread capture.

---

## Thread Save Decision

Before adding thread save to a new integration:

1. **Is there a registered file-backed parser and stable session identity?**
   Use the CLI's lifecycle capture queue when the host has a flushed transcript
   and a hook; retain `nmem t capture` compatibility until the new CLI ships.
   Use `nmem t save --from <runtime>` for an explicit manual save.
2. **Does the SDK expose structured messages with stable IDs instead?** Use
   the existing acknowledged incremental import adapter, not a fabricated
   transcript or the file-backed hook protocol.
3. **Neither?** Use `save-handoff` and describe it honestly.

**Never fake `save-thread`** in a runtime that doesn't support real transcript import.

### Compaction boundary rule

Treat compaction as a possible data-loss boundary.

- If the host provides both a pre-compaction/pre-compression hook and a transcript path, register capture there as well as at normal session end.
- If the host only provides post-compaction recovery, use it for Working Memory reload and recall, but do not describe that as pre-compaction transcript capture.
- If the host does not expose a transcript-backed importer, use `save-handoff` language. Do not imply a hook can preserve the full thread.
- Pre-compaction capture should be idempotent and should pass the host session id and working directory through to `nmem` or the plugin capture API.

---

## Agent Plugins Standard Package

`nowledge-mem-agent-plugin/` is the portable Agent Plugins 1.0 package.

Use it only as the standards fallback for clients that support Agent Plugins but
do not have a dedicated Nowledge connector. Dedicated connectors remain the
preferred path because they can use host-specific lifecycle hooks, transcript
paths, and recovery steps.

Package invariants:

- Root `plugin.json` must stay valid against `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.
- Root `mcp.json` must stay valid against `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`.
- The published `mcp.json` must not contain bearer tokens, API keys, or user-specific remote endpoints.
- The portable package must not claim automatic full-thread capture unless the standard adds portable lifecycle hooks and transcript access.
- Do not add a root Agent Plugins `plugin.json` to an existing native connector package until that host's native discovery behavior has been validated. Codex already prefers root Agent Plugins manifests over legacy plugin locations.
- Keep `nowledge-mem-agent-plugin/skills` aligned with `nowledge-mem-npx-skills/skills` whenever shared skill behavior changes.

---

## Registry Checklist

When shipping a new integration:

1. [ ] Add entry to `community/integrations.json` — **always update the registry first**
2. [ ] Align behavioral guidance with `community/shared/behavioral-guidance.md`
3. [ ] Use `nowledge_mem_*` tool naming (or document platform convention)
4. [ ] Update `community/README.md` integration table
5. [ ] Verify `nowledge-labs-website/nowledge-mem/data/integrations.ts` alignment
6. [ ] Add marketplace entry if applicable (`.claude-plugin/`, `.github/plugin/`, `.cursor-plugin/`, `.factory-plugin/`)
7. [ ] If the integration is standards-compatible, update `nowledge-mem-agent-plugin` only when the standard package is actually the install surface
8. [ ] Update `nowledge-mem-npx-skills/skills/check-integration/SKILL.md` detection table
9. [ ] Add integration docs page to website (EN + ZH)

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
