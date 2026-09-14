# Nowledge Mem Agent Plugin

Portable Agent Plugins package for clients that implement the [Agent Plugins 1.0](https://agent-plugins.org/) standard.

Use this package when your AI client supports Agent Plugins but does not have a dedicated Nowledge Mem connector yet. If a native connector exists for your tool, install that first: native connectors can add lifecycle hooks, host-specific setup, and real transcript import that a portable package cannot guarantee.

## What It Includes

- `plugin.json` using the Agent Plugins 1.0 manifest schema
- `mcp.json` registering the local Nowledge Mem Streamable HTTP MCP endpoint
- Shared Nowledge Mem skills for startup context, recall, focused graphs, distillation, status checks, and handoff summaries

## Install

Install this directory from an Agent Plugins-compatible client marketplace or from source:

```text
https://github.com/nowledge-co/community/tree/main/nowledge-mem-agent-plugin
```

After install, start Nowledge Mem Desktop or point your local `nmem` CLI at your remote Mem server, then restart the client if it does not hot-reload plugins.

## Local vs Remote Mem

The standard `mcp.json` deliberately points to local Mem:

```text
http://127.0.0.1:14242/mcp
```

Agent Plugins 1.0 allows literal HTTP headers, but does not define a safe cross-client credential reference for API keys. Do not publish private keys in this package.

For Nowledge Cloud, Access Anywhere, or self-hosted remote Mem, use the client's private MCP settings instead. The safest way to generate that config is:

```bash
nmem config mcp show --host <your-client>
```

If the CLI does not know your client yet, copy the generated URL and authentication values from Nowledge Mem app: **Connectors -> AI Tools** or **Settings -> Mem access**.

## Capabilities

This package gives compatible agents a baseline memory surface:

- Read Context Bundle / Working Memory at the start of work
- Search memories and prior threads when context would help
- Show a focused graph after non-empty Memory retrieval with [Explore Graph](skills/explore-graph/SKILL.md), or follow related memories one hop at a time
- Distill durable decisions, procedures, and debugging breakthroughs
- Check Nowledge Mem status
- Save an honest resumable handoff when a full transcript importer is unavailable

It does not claim automatic full-thread capture. Portable Agent Plugins expose skills and MCP, but lifecycle hooks and transcript access remain client-specific in Agent Plugins 1.0. Use a dedicated Nowledge connector when you need host-level thread sync.

Graph viewing prefers the host's inline MCP App support, then a standalone
browser or link fallback using the configured Mem endpoint. Remote links need
the browser's existing authenticated session; credentials never appear in URLs.
Graph viewing requires the retrieval's owner/member permissions and active
space; exact result IDs do not enforce access control. Space- or Team-restricted
searches require confirmed graph enforcement of the same restrictions. Browser
links also require confirmation of the browser's identity and scope, which the
CLI configuration does not establish. When those checks are unavailable, the
agent skips the graph and continues with the successful search results.

## Dedicated Connectors Still Win

Prefer the dedicated connector when your host has one: Claude Code, Codex, Gemini CLI, OpenClaw, OpenCode, Copilot CLI, Pi, OMP, Kimi Code, Hermes Agent, Proma, WorkBuddy, CodeBuddy, Alma, Cursor, or another supported host in the Nowledge Mem connector guide.

See the current list at:

```text
https://mem.nowledge.co/docs/integrations
```

## Development

The skills in this package are copied from `nowledge-mem-npx-skills/skills`.
The npx `explore-graph/SKILL.md` is the canonical graph source; this package
ships an identical ordinary file and needs no files outside its install
directory. Follow the [shared graph maintenance instructions](../nowledge-mem-npx-skills/README.md#maintaining-the-shared-graph-skill)
to synchronize its Codex and Agent Plugins copies. Keep the two generic
`search-memory` skills aligned too.

From the community repository root, run:

```bash
python3 -m unittest nowledge-mem-codex-plugin/tests/test_codex_plugin.py
python3 -m pytest tests/plugin_e2e/test_key_plugins_e2e.py -q -k key_plugin_static_contracts_are_declared
```
