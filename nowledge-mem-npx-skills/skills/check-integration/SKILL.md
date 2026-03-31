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

## Step 2: Detect Agent and Recommend Native Plugin

These skills work in any agent via CLI. But native plugins provide richer features: auto-recall at prompt time, auto-capture at session end, graph exploration tools, and Working Memory injection.

Check which agent you're running in and recommend the native plugin if available.

The canonical source for this table is `community/integrations.json`.

| Agent | How to Detect | Native Plugin Install | Docs |
|-------|--------------|----------------------|------|
| **Claude Code** | Running as Claude Code agent; `~/.claude/` exists | `claude plugin marketplace add nowledge-co/community && claude plugin install nowledge-mem@nowledge-community` | [Guide](https://mem.nowledge.co/docs/integrations/claude-code) |
| **OpenClaw** | Running as OpenClaw agent; `~/.openclaw/` exists | `openclaw plugins install @nowledge/openclaw-nowledge-mem` | [Guide](https://mem.nowledge.co/docs/integrations/openclaw) |
| **Cursor** | Running inside Cursor IDE | Install from Cursor Marketplace (search "Nowledge Mem") | [Guide](https://mem.nowledge.co/docs/integrations/cursor) |
| **Gemini CLI** | Running as Gemini CLI agent; `~/.gemini/` exists | Search "Nowledge Mem" in the Gemini CLI Extensions Gallery | [Guide](https://mem.nowledge.co/docs/integrations/gemini-cli) |
| **Alma** | Running inside Alma; `~/.config/alma/` exists | In Alma: Settings > Plugins > Marketplace, search "Nowledge Mem" | [Guide](https://mem.nowledge.co/docs/integrations/alma) |
| **Droid** | Running inside Droid (Factory) | Add nowledge-co/community marketplace, install nowledge-mem@nowledge-community | [Guide](https://mem.nowledge.co/docs/integrations/droid) |
| **Codex CLI** | Running as Codex CLI agent; `~/.codex/` exists | Copy `nowledge-mem-codex-plugin` to `~/.codex/plugins/nowledge-mem` | [Guide](https://mem.nowledge.co/docs/integrations/codex-cli) |
| **Bub** | Running inside Bub | `pip install nowledge-mem-bub` | [Guide](https://mem.nowledge.co/docs/integrations/bub) |

If the agent is not listed above, the npx skills you already have are the best option. They work everywhere via the `nmem` CLI.

## Step 3: Verify

After setup, verify with:

```bash
nmem --json m search "test" -n 1
```

If this returns results (or an empty list with no error), the integration is working.

## What Native Plugins Add

Skills give you CLI-based memory access. Native plugins add:

- **Auto-recall**: relevant memories injected before each response (no manual search needed)
- **Auto-capture**: conversations saved as searchable threads at session end
- **LLM distillation**: key decisions and insights extracted automatically
- **Graph tools**: explore connections, evolution chains, and entity relationships
- **Working Memory**: daily briefing injected at session start
- **Slash commands**: `/remember`, `/recall`, `/forget` (where supported)

## Links

- [All integrations](https://mem.nowledge.co/docs/integrations)
- [Documentation](https://mem.nowledge.co/docs)
- [Discord Community](https://nowled.ge/discord)
