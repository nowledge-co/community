---
name: check-integration
description: Check Nowledge Mem setup, detect your agent, and guide native plugin installation. Use when the user asks about setup, configuration, or when memory tools aren't working as expected.
---

# Check Integration

> Verify Nowledge Mem is running and guide the user to the best integration for their agent.

## When to Use

- User asks about Nowledge Mem setup or configuration
- Memory tools are failing or not available
- User asks "is my memory working?" or "how do I set up Nowledge Mem?"
- First time using Nowledge Mem in this agent
- User asks about upgrading from skills to a native plugin

## Step 1: Check nmem CLI

```bash
nmem --json status
```

If this fails, Nowledge Mem is not installed or not running. Guide the user:
- Install: https://mem.nowledge.co/docs/installation
- Start: open the Nowledge Mem desktop app, or run the server

## Step 2: Detect Agent and Recommend The Best Path

Do not only answer "install X". Explain the behavior contract the user will get:

1. what starts automatically
2. what is only guided by skills/rules and still model-driven
3. whether threads are captured automatically, saved explicitly, or only supported as handoff summaries

Use this priority order:

1. **Native integration first** when the host has one
2. **Reusable package** when the host supports shared skills/prompts but has no native integration
3. **Direct MCP** only when there is no better package path

Fresh users care about outcome, not transport. Tell them what they will actually get after setup.

### Autonomy levels

| Path | What usually happens | What it does not guarantee |
|------|----------------------|----------------------------|
| **Native integration** | Strongest setup: session bootstrap is often automatic; some hosts also add auto-capture or hook-driven recall | Exact proactive recall/distill timing can still be host-specific |
| **Reusable package** | Working Memory, recall, and distill are guided by rules/skills | The host may still ignore the guidance unless prompts and project guidance are strong |
| **Direct MCP** | Tools are available; with the recommended prompt block, the agent can use them proactively | MCP alone does not create host-enforced autonomy |

Check which agent you're running in and recommend the native plugin if available.

The canonical source for this table is `community/integrations.json`.

| Agent | How to Detect | Native Plugin Install | Docs |
|-------|--------------|----------------------|------|
| **Claude Code** | Running as Claude Code agent; `~/.claude/` exists | `claude plugin marketplace add nowledge-co/community && claude plugin install nowledge-mem@nowledge-community` | [Guide](https://mem.nowledge.co/docs/integrations/claude-code) |
| **OpenClaw** | Running as OpenClaw agent; `~/.openclaw/` exists | `openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem` | [Guide](https://mem.nowledge.co/docs/integrations/openclaw) |
| **Cursor** | Running inside Cursor IDE | Link `nowledge-mem-cursor-plugin` into `~/.cursor/plugins/local/nowledge-mem-cursor`, then reload Cursor | [Guide](https://mem.nowledge.co/docs/integrations/cursor) |
| **Gemini CLI** | Running as Gemini CLI agent; `~/.gemini/` exists | Search "Nowledge Mem" in the Gemini CLI Extensions Gallery | [Guide](https://mem.nowledge.co/docs/integrations/gemini-cli) |
| **Alma** | Running inside Alma; `~/.config/alma/` exists | In Alma: Settings > Plugins > Marketplace, search "Nowledge Mem" | [Guide](https://mem.nowledge.co/docs/integrations/alma) |
| **Droid** | Running inside Droid (Factory) | Add nowledge-co/community marketplace, install nowledge-mem@nowledge-community | [Guide](https://mem.nowledge.co/docs/integrations/droid) |
| **Codex CLI** | Running as Codex CLI agent; `~/.codex/` exists | `codex plugin marketplace add nowledge-co/community` (legacy fallback: `codex marketplace add nowledge-co/community`), install `nowledge-mem@nowledge-community` from `/plugins`, then enable `[features] plugins = true` and `[plugins."nowledge-mem@nowledge-community"] enabled = true` in `~/.codex/config.toml`. Add `mcp_servers.nowledge-mem` only when overriding the bundled local MCP endpoint. | [Guide](https://mem.nowledge.co/docs/integrations/codex-cli) |
| **Bub** | Running inside Bub | `pip install nowledge-mem-bub` | [Guide](https://mem.nowledge.co/docs/integrations/bub) |
| **Pi** | Running as Pi agent; `~/.pi/` exists | `pi install npm:nowledge-mem-pi` | [Guide](https://mem.nowledge.co/docs/integrations/pi) |
| **OpenCode** | Running as OpenCode agent; `~/.config/opencode/` or `.opencode/` exists | Add `"opencode-nowledge-mem"` to `opencode.json` plugin array | [Guide](https://mem.nowledge.co/docs/integrations/opencode) |
| **Hermes Agent** | Running as Hermes agent; `~/.hermes/` exists | Install the native Hermes provider (or use MCP only as fallback) | [Guide](https://mem.nowledge.co/docs/integrations/hermes) |

If the agent is not listed above:

- use the shared `npx skills` package when the host supports it
- otherwise use direct MCP plus the recommended prompt block

Do not describe raw MCP as equivalent to a native integration.

## Step 3: Verify

After setup, verify with:

```bash
nmem --json m search "test" -n 1
```

If this returns results (or an empty list with no error), the integration is working.

Then state the expected outcome in plain language:

- **Working Memory**: automatic, guided, or manual
- **Recall**: automatic, guided, or manual
- **Distill**: automatic, guided, or manual
- **Threads**: automatic capture, explicit save, handoff-only, or none

If the path is only `guided`, say what strengthens it:

- keep `nmem` available locally
- restart the host after install
- merge the package `AGENTS.md` or equivalent repo guidance when recommended
- configure the local `nmem` client in remote mode

## What Native Plugins Add

Skills give you CLI-based memory access. Native plugins usually add:

- **Auto-recall**: relevant memories injected before each response (no manual search needed)
- **Auto-capture**: conversations saved as searchable threads at session end
- **LLM distillation**: key decisions and insights extracted automatically
- **Graph tools**: explore connections, evolution chains, and entity relationships
- **Working Memory**: daily briefing loaded or injected at session start
- **Slash commands**: `/remember`, `/recall`, `/forget` (where supported)

Do not promise all of these on every host. Match the actual path the user is setting up.

## Links

- [All integrations](https://mem.nowledge.co/docs/integrations)
- [Documentation](https://mem.nowledge.co/docs)
- [Discord Community](https://nowled.ge/discord)
