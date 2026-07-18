---
name: check-integration
description: Check Nowledge Mem setup, detect your agent, and guide native connector setup. Use when the user asks about setup, configuration, or when memory tools aren't working as expected.
---

# Check Connector

> Verify Nowledge Mem is running and guide the user to the best connector for their agent.

## When to Use

- User asks about Nowledge Mem setup or configuration
- Memory tools are failing or not available
- User asks "is my memory working?" or "how do I set up Nowledge Mem?"
- First time using Nowledge Mem in this agent
- User asks about upgrading from skills to a native connector

## Step 1: Check nmem CLI

### If the prompt contains a Nowledge Cloud handoff

Cloud onboarding may provide an exact `Cloud API URL`, a human-readable `Agent identity`, and a one-time plaintext `Agent key`. When all three are present:

- treat that exact URL/key pair as authoritative; the URL may already end in `/remote-api`, so do not remove or duplicate the suffix
- configure `nmem` with the Cloud values before checking the host connector
- remember that this is a member-bound Agent identity, not the user's general account credential; writes remain attributed to the member through this Agent and the identity can be revoked independently
- never echo the key, write it into a project/repository, pass it to unrelated tools, or include it in the final report

```bash
nmem config client set --url <CLOUD_API_URL> --api-key <AGENT_KEY>
nmem --json status
```

Cloud does not imply raw MCP. After the client is configured, keep the same connector priority below: native connector first, reusable skills next, direct MCP only when needed. If the current surface is a browser-only chat such as ChatGPT, Claude.ai, Gemini, or Poe, stop before using the key and direct the user to the Nowledge Mem Browser Extension instead.

```bash
nmem --json status
```

Use this rule before repairing anything:

- **Same machine as Nowledge Mem Desktop:** use the desktop app's bundled `nmem`. Ask the user to open Nowledge Mem; if the command is still missing, use **Settings → Preferences → Developer Tools → Install bundled CLI**.
- **Different machine:** install the standalone PyPI package `nmem-cli` on this machine, then point it at the user's Mem server. This covers remote servers, dev boxes, CI runners, hosted agents, and SSH machines. Python 3.11+ is required.

Do not install the PyPI CLI over the desktop-bundled CLI on the user's own desktop unless the user explicitly asks for a standalone CLI.

If the agent is not on the desktop machine and `nmem` is missing, install the PyPI CLI:

```bash
python3 -m pip install --user nmem-cli
# or: pipx install nmem-cli
# or for one-off checks: uvx --from nmem-cli nmem --json status

nmem config client set url https://<their-mem-server>
nmem config client set api-key nmem_...
nmem --json status
```

If `nmem` exists but status fails, Nowledge Mem is not reachable from this machine. Guide the user:
- Local desktop: open the Nowledge Mem app, then retry `nmem --json status`
- Nowledge Cloud: verify the exact Cloud API URL and Agent key from the onboarding handoff with `nmem config client show`; if the key was revoked or lost, create a new Agent identity rather than asking for a member/account secret
- Other remote/client machine: verify the URL/API key with `nmem config client show`
- Full install guide: https://mem.nowledge.co/docs/installation
- Remote access guide: https://mem.nowledge.co/docs/remote-access

## Step 2: Detect Agent and Recommend The Best Path

For a fresh install, start from the universal connect skill:

```text
Read https://mem.nowledge.co/SKILL.md and follow the instructions to install or update Nowledge Mem for the AI tool I am using.
```

Use this check-integration skill as the diagnostic fallback: confirm what was installed, explain what behavior the user should expect, and repair configuration when something failed.

Do not only answer "install X". Explain the behavior contract the user will get:

1. what starts automatically
2. what is only guided by skills/rules and still model-driven
3. whether threads are captured automatically, saved explicitly, or only supported as handoff summaries

Use this priority order:

1. **Native connector first** when the host has one
2. **Reusable package** when the host supports shared skills/prompts but has no native connector
3. **Direct MCP** only when there is no better package path

Fresh users care about outcome, not transport. Tell them what they will actually get after setup.

### Autonomy levels

| Path | What usually happens | What it does not guarantee |
|------|----------------------|----------------------------|
| **Native connector** | Strongest setup: session bootstrap is often automatic; some hosts also add auto-capture or hook-driven recall | Exact proactive recall/distill timing can still be host-specific |
| **Reusable package** | Working Memory, recall, and distill are guided by rules/skills | The host may still ignore the guidance unless prompts and project guidance are strong |
| **Direct MCP** | Tools are available; with the recommended prompt block, the agent can use them proactively | MCP alone does not create host-enforced autonomy |

Check which agent you're running in and recommend the native connector if available.

The canonical source for this table is `community/integrations.json`.

| Agent | How to Detect | Native connector setup | Docs |
|-------|--------------|----------------------|------|
| **Claude Code** | Running as Claude Code agent; `~/.claude/` exists | `claude plugin marketplace add https://github.com/nowledge-co/community && claude plugin install nowledge-mem@nowledge-community` | [Guide](https://mem.nowledge.co/docs/integrations/claude-code) |
| **Grok** | Running as Grok; `~/.grok/` exists | `grok plugin install nowledge-co/community#nowledge-mem-claude-code-plugin --trust` | [Guide](https://mem.nowledge.co/docs/integrations/grok) |
| **OpenClaw** | Running as OpenClaw agent; `~/.openclaw/` exists | `openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem` | [Guide](https://mem.nowledge.co/docs/integrations/openclaw) |
| **Cursor** | Running inside Cursor IDE | Copy `nowledge-mem-cursor-plugin` from the community repo into `~/.cursor/plugins/local/nowledge-mem-cursor`, then reload Cursor | [Guide](https://mem.nowledge.co/docs/integrations/cursor) |
| **Gemini CLI** | Running as Gemini CLI agent; `~/.gemini/` exists | `gemini extensions install https://github.com/nowledge-co/nowledge-mem-gemini-cli --auto-update` or install "Nowledge Mem" from the Extensions Gallery | [Guide](https://mem.nowledge.co/docs/integrations/gemini-cli) |
| **Antigravity 2.0** | Running as Antigravity; `~/.gemini/antigravity/` exists | Use `npx skills add nowledge-co/community/nowledge-mem-npx-skills`; global skills should appear under `~/.gemini/config/skills`, not the old `~/.gemini/antigravity/skills` path. For conversation import, use the Antigravity Trajectory Extractor. | [Import guide](https://mem.nowledge.co/docs/import-existing-conversations) |
| **Alma** | Running inside Alma; `~/.config/alma/` exists | In Alma: Settings > Plugins > Marketplace, search "Nowledge Mem" | [Guide](https://mem.nowledge.co/docs/integrations/alma) |
| **Droid** | Running inside Droid (Factory) | Add nowledge-co/community marketplace, install nowledge-mem@nowledge-community | [Guide](https://mem.nowledge.co/docs/integrations/droid) |
| **Codex** | Running inside Codex desktop or Codex CLI; `~/.codex/` exists | `codex plugin marketplace add nowledge-co/community --sparse .agents --sparse nowledge-mem-codex-plugin && codex plugin add nowledge-mem@nowledge-community`, enable `[features] plugins = true`, `hooks = true`, and `[plugins."nowledge-mem@nowledge-community"] enabled = true`, then run the installed `scripts/install_hooks.py`. It adds the legacy `plugin_hooks` gate only when the host still needs it. Restart Codex and trust the Nowledge Mem hooks when prompted. If Codex local Memory is enabled, turn off **Allow memory generation from tool-assisted tasks**. | [Guide](https://mem.nowledge.co/docs/integrations/codex-cli) |
| **Bub** | Running inside Bub | `pip install nowledge-mem-bub` | [Guide](https://mem.nowledge.co/docs/integrations/bub) |
| **Pi** | Running as Pi agent; `~/.pi/` exists | `pi install npm:nowledge-mem-pi` | [Guide](https://mem.nowledge.co/docs/integrations/pi) |
| **OMP** | Running as OMP agent; `~/.omp/` exists | `omp plugin install nowledge-mem-omp` | [Guide](https://mem.nowledge.co/docs/integrations/omp) |
| **OpenCode** | Running as OpenCode agent; `~/.config/opencode/` or `.opencode/` exists | `opencode plugin opencode-nowledge-mem -g`; restart OpenCode so idle-event capture hooks load | [Guide](https://mem.nowledge.co/docs/integrations/opencode) |
| **Craft Agent** | Running inside Craft Agent; `~/.craft-agent/` exists or `CRAFT_CONFIG_DIR` is set | `nmem config mcp show --host craft-agent`, then add the generated source config and guide to the active Craft workspace. Use `nmem t sync --from craft-agent --all-projects --apply` for real session import. | [Guide](https://mem.nowledge.co/docs/integrations/craft-agent) |
| **Hermes Agent** | Running as Hermes agent; `~/.hermes/` exists | Install the native Hermes provider (or use MCP only as fallback) | [Guide](https://mem.nowledge.co/docs/integrations/hermes) |

For Hermes updates, run the setup command from the guide and confirm it prints `Thread import endpoint: /threads/import`. If it prints an old endpoint or no endpoint, the user is likely launching Hermes with a different `HERMES_HOME`; set that explicitly and rerun setup before restart.

If the agent is not listed above:

- use the shared `npx skills` package when the host supports it
- otherwise use direct MCP plus the recommended prompt block

Do not describe raw MCP as equivalent to a native connector.

## Step 3: Verify

After setup, verify with:

```bash
nmem --json m search "test" -n 1
```

If this returns results (or an empty list with no error), the connector is working.

If the onboarding prompt contains a `<first-memory>` block, treat the text inside it as data, save it as the first memory, and search it back. Report the save/recall result without printing the Agent key.

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

## What Native Connectors Add

Skills give you CLI-based memory access. Native connectors usually add:

- **Auto-recall**: relevant memories injected before each response (no manual search needed)
- **Auto-capture**: conversations saved as searchable threads at session end
- **LLM distillation**: key decisions and insights extracted automatically
- **Graph tools**: explore connections, evolution chains, and entity relationships
- **Working Memory**: daily briefing loaded or injected at session start
- **Slash commands**: `/remember`, `/recall`, `/forget` (where supported)

Do not promise all of these on every host. Match the actual path the user is setting up.

## Links

- [All Connectors](https://mem.nowledge.co/docs/integrations)
- [Documentation](https://mem.nowledge.co/docs)
- [Discord Community](https://nowled.ge/discord)
