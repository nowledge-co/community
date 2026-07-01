# Nowledge Community

<div align="center">

<img src="https://github.com/user-attachments/assets/fbf6f921-ff0a-40dc-be43-8f9b0d66cb09" width="200" alt="Nowledge Community Logo">

**Community integrations for [Nowledge Mem](https://mem.nowledge.co)**


[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=flat&logo=discord&logoColor=white)](https://nowled.ge/discord)
[![Docs](https://img.shields.io/badge/Docs-Read-orange?style=flat&logo=readthedocs&logoColor=white)](https://nowled.ge/mem-docs)

---

</div>

## Registry

The canonical source of truth for all integrations is [`integrations.json`](integrations.json). Capabilities, install commands, transport, tool naming, thread save methods, and the user-facing autonomy contract are tracked there. Update the registry first when adding or modifying integrations.

The autonomy contract uses one shared language across integrations:

- `automatic`: the host/plugin enforces it through hooks or lifecycle wiring
- `guided`: the package/rules/skills strongly teach it, but the model still decides
- `manual`: it only happens when the user or agent asks directly

This keeps one critical distinction honest for fresh users: having tools available is not the same thing as getting autonomous memory behavior.

For behavioral guidance (when to read Context Bundle, use Working Memory fallback, search, save, and route ambient spaces), see [`shared/behavioral-guidance.md`](shared/behavioral-guidance.md). For plugin authoring rules, see [`docs/PLUGIN_DEVELOPMENT_GUIDE.md`](docs/PLUGIN_DEVELOPMENT_GUIDE.md).

For end-user customization that survives updates, see [`docs/USER_OVERRIDE_GUIDE.md`](docs/USER_OVERRIDE_GUIDE.md). The short version: do not edit installed plugin files; use the host's own instruction files when that host supports them.

For multi-agent orchestrators that launch Codex, Claude Code, OpenCode, or other
child CLIs, set `NMEM_AGENT_ID=<agent-slug>` in each child process. Add
`NMEM_SPACE=<space>` only when that run should override the AI Identity's
default space. `NMEM_HOST_AGENT_ID` is for advanced external aliases, not a
second required identity variable. The child plugin still reports its real
runtime as `source_app`; the env var selects the right Nowledge AI Identity
through Context Bundle.

## Integrations

Each directory is a standalone integration. Pick the one that matches your tool.

| Integration | Install | What it does |
|-------------|---------|--------------|
| **[Skills](nowledge-mem-npx-skills)** | `npx skills add nowledge-co/community/nowledge-mem-npx-skills` | Reusable workflow package for Context Bundle / Working Memory startup context, routed recall, resumable handoffs, and distillation. Prefer native packages when your tool has one. |
| **[Claude Code Plugin](nowledge-mem-claude-code-plugin)** | `claude plugin marketplace add https://github.com/nowledge-co/community` then `claude plugin install nowledge-mem@nowledge-community` | Claude Code native plugin with hooks for Context Bundle / Working Memory startup context, routed recall, automatic session capture, and pre-compaction transcript save. |
| **[Grok Build Plugin](nowledge-mem-claude-code-plugin)** | `grok plugin install nowledge-co/community#nowledge-mem-claude-code-plugin --trust` | Grok loads the shared Claude-compatible package, with Grok-aware Context Bundle startup and `nmem t save --from grok` session capture. |
| **[Copilot CLI Plugin](nowledge-mem-copilot-cli-plugin)** | `copilot plugin marketplace add nowledge-co/community` then `copilot plugin install nowledge-mem@nowledge-community` | GitHub Copilot CLI plugin with startup context guidance, routed recall, incremental session capture, and pre-compaction transcript save. |
| **[Droid Plugin](nowledge-mem-droid-plugin)** | `droid plugin marketplace add https://github.com/nowledge-co/community` then `droid plugin install nowledge-mem@nowledge-community` | Factory Droid plugin with Context Bundle / Working Memory startup context, routed recall, distillation, and honest `save-handoff` semantics. |
| **[Gemini CLI](https://github.com/nowledge-co/nowledge-mem-gemini-cli)** | Search `Nowledge Mem` in the [Gemini CLI Extensions Gallery](https://geminicli.com/extensions/?name=nowledge-co/nowledge-mem-gemini-cli) and install | Gemini-native context, bundled MCP, hooks, commands, and skills for Context Bundle / Working Memory startup context, routed recall, real thread save before compression or exit, and handoff summaries. |
| **[Antigravity Trajectory Extractor](https://github.com/jijiamoer/antigravity-trajectory-extractor)** | `git clone https://github.com/jijiamoer/antigravity-trajectory-extractor.git` | Live RPC extraction for Antigravity conversation trajectories. |
| **[Windsurf Trajectory Extractor](https://github.com/jijiamoer/windsurf-trajectory-extractor)** | `git clone https://github.com/jijiamoer/windsurf-trajectory-extractor.git` | Offline protobuf extraction for Windsurf Cascade conversation history. |
| **[Cursor Plugin](nowledge-mem-cursor-plugin)** | Link `nowledge-mem-cursor-plugin` into `~/.cursor/plugins/local/nowledge-mem-cursor` | Cursor-native plugin package with session-start context guidance, bundled MCP config, rules, and honest `save-handoff` semantics. |
| **[Codex Plugin](nowledge-mem-codex-plugin)** | `codex plugin marketplace add nowledge-co/community` then `codex plugin add nowledge-mem@nowledge-community`; enable `plugins`, `hooks`, and `plugin_hooks`, then run the setup script | Hybrid Codex path: plugin package plus bundled local MCP for stronger retrieval and memory writes, with the Stop hook calling `nmem` for real session capture. |
| **Slock** | Configure per-worker environment variables in Slock runtime config | Multi-agent orchestrator setup: install the child runtime connector first, then set `NMEM_AGENT_ID=<agent-slug>` for each named Slock worker. |
| **Lody** | Configure the child runtime in Lody Agent Config | Runtime launcher setup: install the child runtime connector first; set `NMEM_AGENT_ID=<agent-slug>` only when that Agent Config represents a stable role. |
| **Multica** | Configure the Multica agent custom environment | Multi-agent orchestrator setup: install the daemon's child runtime connector first, then set `NMEM_AGENT_ID=<agent-slug>` in the agent custom environment. |
| **Cumora** | Configure the child runtime plus each teammate persona | AI teammate workspace setup: connect Mem at the runtime/daemon boundary, then use a per-persona Context Bundle instruction unless Cumora exposes per-agent runtime environment variables. |
| **Paseo** | Configure the child runtime that Paseo launches | Multi-agent orchestration setup: install the connector for Codex, Claude Code, OpenCode, or Pi first for automatic new-thread capture; use `nmem t sync --from paseo --all-projects --apply` to import supported child-session history from Paseo's registry without creating duplicate child threads; set `NMEM_AGENT_ID=<agent-slug>` only for durable Paseo agent roles. |
| **[OpenClaw Plugin](nowledge-mem-openclaw-plugin)** | `openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem` | Full memory lifecycle with memory tools, thread tools, automatic capture, and distillation. |
| **[Alma Plugin](nowledge-mem-alma-plugin)** | Search Nowledge in Alma official Plugin marketplace | Alma-native plugin with startup context, thread-aware recall, structured saves, and optional auto-capture. |
| **[Bub Plugin](nowledge-mem-bub-plugin)** | `pip install nowledge-mem-bub` | Bub-native plugin: cross-tool knowledge, auto-capture via save_state, startup context, and graph exploration. |
| **[Pi Package](nowledge-mem-pi-package)** | `pi install npm:nowledge-mem-pi` | Five composable skills for Context Bundle / Working Memory startup context, routed recall, distillation, and resumable handoffs in Pi. |
| **[OpenCode Plugin](nowledge-mem-opencode-plugin)** | Add `"opencode-nowledge-mem"` to `opencode.json` plugins | Native OpenCode plugin with tools for Context Bundle, Working Memory, search, save, update, thread search, session capture, handoff, and status. |
| **[Kimi Code Plugin](nowledge-mem-kimi-code-plugin)** | `/plugins install ~/.cache/nowledge-community/nowledge-mem-kimi-code-plugin`, then `python3 ~/.cache/nowledge-community/nowledge-mem-kimi-code-plugin/scripts/install_hooks.py` | Kimi-native plugin metadata, session-start skill, bundled local MCP, and explicit lifecycle hook setup for real Kimi Code thread capture through `nmem`. |
| **[Kimi Work Connector](nowledge-mem-kimi-work-connector)** | `python3 ~/.cache/nowledge-community/nowledge-mem-kimi-work-connector/scripts/install_kimi_work_plugin.py` | Kimi Work desktop connector for its embedded Kimi Code runtime: session-start skill, bundled local MCP, and explicit `nmem t sync --from kimi-work` session import. |
| **[Hermes Agent](nowledge-mem-hermes)** | `bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh)` | Native Hermes memory provider with Context Bundle / Working Memory startup context, pre-turn recall, clean `nmem_` tools, and session-end transcript capture into Mem threads. MCP remains available as a fallback mode. |
| **[Proma Plugin](nowledge-mem-proma-plugin)** | Manual setup with MCP, hooks, and skills; see [Proma guide](https://mem.nowledge.co/docs/integrations/proma) | Proma desktop agent setup with startup context, Stop-hook thread capture, MCP memory tools, and standard Nowledge Mem skills. |
| **[Raycast Extension](nowledge-mem-raycast)** | Search Nowledge in Raycast Extension Store | Search memories from Raycast launcher. |
| **[Claude Desktop](https://github.com/nowledge-co/claude-dxt)** | Download from [nowled.ge/claude-dxt](https://nowled.ge/claude-dxt), double-click `.mcpb` file | One-click extension for Claude Desktop with memory search, save, and update. |
| **[Browser Extension](https://chromewebstore.google.com/detail/nowledge-memory-exchange/kjgpkgodplgakbeanoifnlpkphemcbmh)** | Install from Chrome Web Store | Side-panel capture for ChatGPT, Claude, Gemini, Perplexity, and other web AI surfaces. |
| **[MCP](#direct-mcp)** | For tools without a dedicated Nowledge package, use [direct MCP](#direct-mcp). | Standard memory and thread tools exposed through one shared MCP server. |

## Direct MCP

Add to your tool's MCP settings:

```json
{
  "mcpServers": {
    "nowledge-mem": {
      "url": "http://127.0.0.1:14242/mcp/",
      "type": "streamableHttp"
    }
  }
}
```

See [mcp.json](mcp.json) for the reference config.

For remote Mem, configure this machine once with `nmem config client set url ...` and `nmem config client set api-key ...`, then generate the exact host config:

```bash
nmem config mcp show --host cursor
nmem config mcp show --host codex
nmem config mcp show --host gemini-cli
```

Direct MCP clients do not read `~/.nowledge-mem/config.json` automatically; paste the generated block into the host's own MCP settings.

## Requirements

- [Nowledge Mem](https://mem.nowledge.co) running locally
- `nmem` CLI on your PATH: if Mem is running on the same machine, install it from **Settings > Preferences > Developer Tools > Install CLI** in the app, use `pip install nmem-cli` for a standalone setup, or on Arch Linux install the [`nmem-cli` AUR package](https://aur.archlinux.org/packages/nmem-cli) with `yay -S nmem-cli` or `paru -S nmem-cli`

```bash
nmem status   # verify Nowledge Mem is running
```

## Spaces

Spaces are optional. Most integrations can stay on `Default` and never mention them.

If a host already has its own profile or provider config, choose the lane there first:

- plugin/provider setting such as `space = "Research Agent"`
- a derived mapping such as `spaceTemplate = "agent-${AGENT_NAME}"`
- an exact identity map such as `space_by_identity = {"research":"Research Agent"}`

Use `NMEM_SPACE="Research Agent"` only for CLI-first hosts or runtimes that do not expose a better config surface. HTTP- or MCP-based integrations should pass `space_id` explicitly when their host/runtime can do so. The storage boundary is still one hidden shared key, but humans and agents should normally work with the space name instead. Legacy `NMEM_SPACE_ID` still works for older setups.

For agent harnesses, the rule is simple:

- If the host can only promise one lane per process or profile, support one fixed ambient space.
- If the host exposes a stable identity or workspace signal, support a derived mapping (`spaceTemplate` or exact identity mapping).
- If the host does not expose identity cleanly, do not fake per-agent routing.

### Space behavior by integration

Use one ambient space only when the host already has a real lane, such as one AI Identity, one project, or one workspace.

| Integration | Ambient space today | Best user setup |
|-------------|---------------------|-----------------|
| Claude Code, Grok, Codex, Droid, Pi, Gemini CLI | Full ambient lane through `NMEM_SPACE` or per-command `--space` | Set one `NMEM_SPACE` only when the whole session truly belongs to one lane. Otherwise stay on `Default`. |
| Hermes | Full ambient lane through provider `space`, `space_by_identity`, `space_template`, or fallback `NMEM_SPACE` | Use `space` for one stable lane, `space_by_identity` for a small explicit map, `space_template` for one lane per Hermes identity. |
| Alma | Full ambient lane through plugin `nowledgeMem.space`, plugin `nowledgeMem.spaceTemplate`, or fallback `NMEM_SPACE` | Use `space` for one Alma profile per lane. Use `spaceTemplate` only when your launcher already exports a trustworthy lane variable. |
| Bub | Full ambient lane through `NMEM_SPACE` | Treat Bub as one process-wide lane. If you need separate lanes, run separate Bub processes or profiles. |
| OpenClaw | Full ambient lane through plugin `space`, plugin `spaceTemplate`, or fallback `NMEM_SPACE`, preserved across CLI memory calls and API-backed thread/feed paths | Use `space` for one stable profile. Use `spaceTemplate` only when the launcher already exports the lane signal. Do not fake per-agent routing if the runtime does not expose identity. |
| OpenCode | Full ambient lane through `NMEM_SPACE`, preserved across CLI memory calls and HTTP session save | Set one `NMEM_SPACE` when the OpenCode process belongs to one real lane. |
| Cursor | Partial today | `sessionStart` and handoff flows can follow `NMEM_SPACE`, but MCP tool calls still need Cursor/runtime support to forward `space_id`. |
| Raycast | One fixed lane through Raycast preferences or shared config | Use one named space when that launcher profile always belongs to one lane. Leave it empty to stay on `Default`. |
| Browser extension | One fixed lane through extension settings | Use one named space when that browser profile always belongs to one lane. Leave it empty to stay on `Default`. |
| Generic MCP-only hosts | Usually default lane only today | Keep using `Default` unless the host can explicitly pass `space_id`. |

What the space profile means is the same everywhere:

- **When this space searches** decides how far automatic recall expands before the agent starts answering.
- **Also search these spaces** adds reusable context lanes for retrieval only. It does not move or merge records.
- **Agent guidance** is read by AI Now and built-in/background agents working in that lane. It changes retrieval and explanation style, not storage.

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Blog](https://www.nowledge-labs.ai/blog/nowledge-mem)
- [Report a Bug](https://github.com/nowledge-co/community/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/nowledge-co/community/issues/new?template=feature_request.md)
- [hello@nowledge-labs.ai](mailto:hello@nowledge-labs.ai)

---

<div align="center">

**Built by [Nowledge Labs](https://nowledge-labs.ai)**

</div>
