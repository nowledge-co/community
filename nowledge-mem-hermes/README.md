# Nowledge Mem for Hermes Agent

> Cross-tool knowledge, accessible in every Hermes session. Your decisions, procedures, and context travel with you.

Hermes has its own memory and learning system. Nowledge Mem complements it with knowledge that spans tools: insights from Claude Code, Cursor, Codex, Gemini, and every other environment you work in. One knowledge graph, available everywhere.

Until this provider is accepted into `NousResearch/hermes-agent`, the supported distribution path is this community package plus the install script below. The upstream PR is the official long-term home; this README keeps the pre-merge path explicit so users can install it now without waiting.

## Install

### Plugin (recommended, Hermes v0.7.0+)

The plugin integrates at the memory-provider level: Working Memory loads automatically, relevant memories are recalled before every turn, and tools use clean names without the `mcp_` prefix.

```bash
bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh)
```

The installer is idempotent. If `~/.hermes/config.yaml` already has a `memory:` block, it now fills a missing or empty `provider` automatically. It still stops and explains the change when `memory.provider` already points at a different non-empty provider.

Or with the interactive setup:

```bash
hermes memory setup
# Select: nowledge-mem
```

Or manually:

1. Copy plugin files to `~/.hermes/plugins/nowledge-mem/`:
   ```bash
   mkdir -p ~/.hermes/plugins/nowledge-mem
   cd ~/.hermes/plugins/nowledge-mem
   for f in plugin.yaml __init__.py provider.py client.py; do
     curl -sLO "https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/$f"
   done
   ```
2. Set the provider in `~/.hermes/config.yaml`:
   ```yaml
   memory:
     provider: "nowledge-mem"
   ```
3. Restart Hermes.

### MCP only (any Hermes version)

If you prefer the standard MCP connection or are on Hermes < v0.7.0:

```bash
bash <(curl -sL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-hermes/setup.sh) --mcp
```

This adds the MCP server to `config.yaml` and installs behavioral guidance in `~/.hermes/SOUL.md`. Tools appear with the `mcp_nowledge_mem_` prefix.

## Prerequisites

1. **Nowledge Mem desktop app** running (or the server accessible on port 14242)
2. **Hermes Agent** installed and configured
3. **`nmem` CLI** available on PATH. If the desktop app is on the same machine, `nmem` is already bundled. Otherwise: `pip install nmem-cli`

## What the plugin does

The plugin uses Hermes' memory provider lifecycle to replace manual Working Memory reads and ad-hoc recall prompting with deterministic hooks:

| Hook | What happens | Replaces |
|------|-------------|----------|
| `system_prompt_block` | Working Memory injected into every session automatically | Manual `read_working_memory` call |
| `prefetch` | Relevant memories searched before each turn | "Search proactively" guidance in SOUL.md |
| `on_memory_write` | User profile facts from Hermes mirrored to Nowledge Mem | Nothing (new capability) |
| `on_pre_compress` | Provides a best-effort recovery hint on Hermes builds that consume provider compression output | Manual compression notes |
| `on_session_end` | Cleaned Hermes transcript captured as a Mem thread when the session actually ends | Manual handoff-only thread save |
| `get_tool_schemas` | 6 native tools with clean names | MCP tools with `mcp_nowledge_mem_` prefix |

Durable knowledge saves still happen through the native `nmem_` tools. In addition, the provider now captures cleaned Hermes session transcripts at real session boundaries such as clean exit, `/new`, and `/reset`. The first flush imports the transcript; later flushes in the same live Hermes session append only the delta. Transcript payloads use the Mem API directly so long sessions are not squeezed into shell arguments.

## Tools

Plugin mode exposes tools directly (no prefix):

| Tool | Purpose |
|------|---------|
| `nmem_search` | Search memories |
| `nmem_save` | Save a decision, insight, or learning |
| `nmem_update` | Refine an existing memory |
| `nmem_delete` | Remove one or more memories |
| `nmem_thread_search` | Search past conversations |
| `nmem_thread_messages` | Fetch messages from a thread |

Graph exploration tools (`neighbors`, `evolves`, `labels`) will be added when the `nmem` CLI supports them.

## Hermes memory vs Nowledge Mem

Hermes has a built-in memory system for facts within Hermes sessions. Nowledge Mem is complementary:

- **Hermes memory**: Hermes-specific preferences, tool quirks, environment details
- **Nowledge Mem**: Decisions, procedures, and learnings that future sessions in any tool should know about

The plugin's `on_memory_write` hook automatically mirrors user profile facts from Hermes to Nowledge Mem, so cross-tool knowledge stays in sync.

## Transport

The plugin shells out to the `nmem` CLI for normal memory operations and posts large transcript payloads directly to the Mem API. The shared `nmem` client config still handles server URL, API key, and remote access configuration. No duplicate network config is needed in the plugin.

If `nmem` is not on PATH, the plugin disables gracefully. On machines running the Nowledge Mem desktop app, `nmem` is already bundled. For remote-only setups: `pip install nmem-cli`.

## Configuration

**No plugin-level network configuration needed.** The `nmem` CLI manages client-side connection settings. Configure remote access for this machine via `nmem config client`:

```bash
nmem config client set url https://your-server
nmem config client set api-key your-key
```

This writes the local client config that Hermes reads through `nmem`. It is separate from server-side access settings like bind host or LAN allowlists.

### Spaces

Spaces are optional. The Hermes provider should usually own the ambient lane directly in `~/.hermes/nowledge-mem.json`:

```json
{
  "timeout": 30,
  "space": "Research Agent",
  "space_by_identity": {
    "research": "Research Agent",
    "ops": "Operations Agent"
  },
  "space_template": "agent-{identity}"
}
```

Use `space` when one Hermes profile always belongs to one lane. Use `space_by_identity` when a few Hermes identities map to named lanes. Use `space_template` when Hermes already has a stable identity and you want one lane per identity.

If you are launching Hermes through a CLI-style wrapper with no provider config of its own, you can still set one session-wide fallback lane with:

```bash
NMEM_SPACE="Research Agent" hermes
```

Plugin-mode Working Memory reads, searches, saves, and thread tools then stay in that lane automatically. If you do not have a real ambient lane, stay on `Default`.

Legacy `NMEM_SPACE_ID` still works, but `NMEM_SPACE` is the preferred human-facing contract when the provider config does not already choose a lane.

Those settings choose the ambient lane only. Shared spaces, default retrieval, and agent guidance still come from Mem's own space profile, so Hermes does not need a second memory-container model on top.

## Verify

Start a new Hermes session. You should see Working Memory loaded in the system prompt. Ask:

> Search my memories for recent decisions.

Hermes should call `nmem_search` (plugin mode) or `mcp_nowledge_mem_memory_search` (MCP mode) and return results.

## Customize without editing the plugin

Hermes already has two clean user-owned instruction layers.

- Global personal rules: `~/.hermes/SOUL.md`
- Repo-level rules: `HERMES.md`
- Do not edit the installed plugin files under `~/.hermes/plugins/nowledge-mem/`

Use `SOUL.md` for your own durable memory preferences and `HERMES.md` for repo-specific expectations.

## Troubleshooting

- **"Nowledge Mem server not reachable"**: Verify the desktop app is running. Check with `nmem status`.
- **"nmem CLI not found"**: Install with `pip install nmem-cli`, or enable CLI in the desktop app: Settings > Developer Tools.
- **Tools not appearing (plugin)**: Confirm `memory.provider: "nowledge-mem"` in config.yaml and plugin files exist in `~/.hermes/plugins/nowledge-mem/`. On older Hermes builds, rerun the setup command; it also places a compatibility copy under `~/.hermes/hermes-agent/plugins/memory/nowledge-mem/` when that runtime still discovers providers from the bundled memory directory. Restart Hermes after reinstalling.
- **Tools not appearing (MCP)**: Confirm `mcp_servers.nowledge-mem` block in config.yaml. Restart Hermes.
- **Hermes recalls but never saves**: In MCP mode, behavioral guidance may be missing from SOUL.md. In plugin mode, the guidance is built-in; check that the plugin loaded with `hermes memory status`.
- **Tool call fails immediately at 0.0s**: Update to v0.5.6 or later. Earlier builds had two separate failure modes: v0.5.3 and below could reject Hermes list-shaped tool arguments for labels or bulk IDs, and v0.5.4 could still advertise `nmem_*` tools before Hermes had actually indexed them for dispatch.
- **Slow responses**: Default timeout is 30 seconds. Increase in `nowledge-mem.json` for remote setups.

## Update

The MCP tools are defined by the Nowledge Mem server. When you update the desktop app, tool capabilities update automatically. For plugin updates, re-run the setup command.

## Links

- [Hermes integration guide](https://mem.nowledge.co/docs/integrations/hermes)
- [Documentation](https://mem.nowledge.co/docs/integrations)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
