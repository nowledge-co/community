# Nowledge Community

<div align="center">

<img src="https://github.com/user-attachments/assets/fbf6f921-ff0a-40dc-be43-8f9b0d66cb09" width="200" alt="Nowledge Community Logo">

**Community integrations for [Nowledge Mem](https://mem.nowledge.co)**


[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=flat&logo=discord&logoColor=white)](https://nowled.ge/discord)
[![Docs](https://img.shields.io/badge/Docs-Read-orange?style=flat&logo=readthedocs&logoColor=white)](https://nowled.ge/mem-docs)

---

</div>

## Registry

The canonical source of truth for all integrations is [`integrations.json`](integrations.json). Capabilities, install commands, transport, tool naming, and thread save methods are tracked there. Update the registry first when adding or modifying integrations.

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
| **[Codex Plugin](nowledge-mem-codex-plugin)** | Copy plugin to `~/.codex/plugins/cache/local/nowledge-mem/local/` and enable it in `~/.codex/config.toml` | Native Codex plugin with five composable skills for Working Memory, routed recall, real session save, and distillation. |
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
