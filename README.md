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

For behavioral guidance (when to search, save, read Working Memory, and route ambient spaces), see [`shared/behavioral-guidance.md`](shared/behavioral-guidance.md). For plugin authoring rules, see [`docs/PLUGIN_DEVELOPMENT_GUIDE.md`](docs/PLUGIN_DEVELOPMENT_GUIDE.md).

## Integrations

Each directory is a standalone integration. Pick the one that matches your tool.

| Integration | Install | What it does |
|-------------|---------|--------------|
| **[Skills](nowledge-mem-npx-skills)** | `npx skills add nowledge-co/community/nowledge-mem-npx-skills` | Reusable workflow package for Working Memory, routed recall, resumable handoffs, and distillation. Prefer native packages when your tool has one. |
| **[Claude Code Plugin](nowledge-mem-claude-code-plugin)** | `claude plugin marketplace add nowledge-co/community` then `claude plugin install nowledge-mem@nowledge-community` | Claude Code native plugin with hooks for Working Memory bootstrap, routed recall, and automatic session capture. |
| **[Droid Plugin](nowledge-mem-droid-plugin)** | `droid plugin marketplace add https://github.com/nowledge-co/community` then `droid plugin install nowledge-mem@nowledge-community` | Factory Droid plugin with Working Memory bootstrap, routed recall, distillation, and honest `save-handoff` semantics. |
| **[Gemini CLI](https://github.com/nowledge-co/nowledge-mem-gemini-cli)** | Search `Nowledge Mem` in the [Gemini CLI Extensions Gallery](https://geminicli.com/extensions/?name=nowledge-co/nowledge-mem-gemini-cli) and install | Gemini-native context, hooks, commands, and skills for Working Memory, routed recall, real thread save, and handoff summaries. |
| **[Antigravity Trajectory Extractor](https://github.com/jijiamoer/antigravity-trajectory-extractor)** | `git clone https://github.com/jijiamoer/antigravity-trajectory-extractor.git` | Live RPC extraction for Antigravity conversation trajectories. |
| **[Windsurf Trajectory Extractor](https://github.com/jijiamoer/windsurf-trajectory-extractor)** | `git clone https://github.com/jijiamoer/windsurf-trajectory-extractor.git` | Offline protobuf extraction for Windsurf Cascade conversation history. |
| **[Cursor Plugin](nowledge-mem-cursor-plugin)** | Link `nowledge-mem-cursor-plugin` into `~/.cursor/plugins/local/nowledge-mem-cursor` | Cursor-native plugin package with a session-start Working Memory hook, bundled MCP config, rules, and honest `save-handoff` semantics. |
| **[Codex Plugin](nowledge-mem-codex-plugin)** | Copy the full plugin directory, including `.codex-plugin`, to `~/.codex/plugins/cache/local/nowledge-mem/local/` and enable it in `~/.codex/config.toml` | Packaged Codex skills for Working Memory bootstrap, proactive recall guidance, real session save, and distillation. |
| **[OpenClaw Plugin](nowledge-mem-openclaw-plugin)** | `openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem` | Full memory lifecycle with memory tools, thread tools, automatic capture, and distillation. |
| **[Alma Plugin](nowledge-mem-alma-plugin)** | Search Nowledge in Alma official Plugin marketplace | Alma-native plugin with Working Memory, thread-aware recall, structured saves, and optional auto-capture. |
| **[Bub Plugin](nowledge-mem-bub-plugin)** | `pip install nowledge-mem-bub` | Bub-native plugin: cross-tool knowledge, auto-capture via save_state, Working Memory, and graph exploration. |
| **[Pi Package](nowledge-mem-pi-package)** | `pi install npm:nowledge-mem-pi` | Five composable skills for Working Memory, routed recall, distillation, and resumable handoffs in Pi. |
| **[OpenCode Plugin](nowledge-mem-opencode-plugin)** | Add `"opencode-nowledge-mem"` to `opencode.json` plugins | Native OpenCode plugin with eight tools for Working Memory, search, save, update, thread search, session capture, handoff, and status. |
| **[Hermes Agent](nowledge-mem-hermes)** | `bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh)` | Native Hermes memory provider with Working Memory bootstrap, pre-turn recall, save guidance, and clean `nmem_` tools. MCP remains available as a fallback mode. |
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
      "url": "http://127.0.0.1:14242/mcp",
      "type": "streamableHttp"
    }
  }
}
```

See [mcp.json](mcp.json) for the reference config.

## Requirements

- [Nowledge Mem](https://mem.nowledge.co) running locally
- `nmem` CLI on your PATH: if Mem is running on the same machine, install it from **Settings > Preferences > Developer Tools > Install CLI** in the app, or use `pip install nmem-cli` for a standalone setup

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

Use one ambient space only when the host already has a real lane, such as one agent identity, one project, or one workspace.

| Integration | Ambient space today | Best user setup |
|-------------|---------------------|-----------------|
| Claude Code, Codex, Droid, Pi, Gemini CLI | Full ambient lane through `NMEM_SPACE` or per-command `--space` | Set one `NMEM_SPACE` only when the whole session truly belongs to one lane. Otherwise stay on `Default`. |
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
