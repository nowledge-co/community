# Nowledge Mem for Codex

> Your Codex agent can start from current context, retrieve past work proactively, and save what is worth keeping.

Switch between Claude Code, Gemini, Cursor, and Codex without losing context. Decisions you made last week, procedures you discovered yesterday, the architecture rationale from three months ago: it's all there when you need it.

## What you get

- **Pick up where you left off.** A native SessionStart hook injects your Context Bundle automatically, with Working Memory as fallback.
- **Stronger retrieval on modern Codex.** The package bundles the local Nowledge Mem MCP server so Codex is more willing to search, inspect prior threads, and write memories proactively.
- **Path-first knowledge browsing.** The `mem_fs` MCP tool and `nmem fs` CLI expose memories, threads, wiki pages, working memory, activities, sources, and artifacts as one tree.
- **Insights stick around.** The package teaches Codex when to distill durable decisions and learnings, and MCP makes the memory-write path cheaper for the runtime to choose.
- **Real session history.** Capture the full Codex transcript through a Stop hook, not just a summary.
- **Quick diagnostics.** One command to verify everything is connected.

The full bootstrap is Context Bundle when available, with Working Memory as the lightweight briefing and compatibility fallback. On modern Codex, the best setup is:

- plugin package for automatic Context Bundle / Working Memory startup context, `nmem` fallback, status, and real `save-thread`
- bundled Nowledge Mem MCP for stronger retrieval and memory writes
- Codex lifecycle hooks for startup context, per-prompt memory routing, and automatic transcript capture
- project `AGENTS.md` for repo-specific follow-through

## Skills

| Skill | When it runs | What it does |
|-------|-------------|-------------|
| `working-memory` | Session start, "what am I working on" | Loads Context Bundle when full identity/scope/rules matter; otherwise loads the daily briefing and prefers MCP when present |
| `search-memory` | Prior work, past decisions | Searches memories and conversations, preferring MCP retrieval when present |
| `save-thread` | Manual fallback, "Save this session" | Imports the real Codex transcript |
| `distill-memory` | Decisions, learnings emerge | Saves durable insights to memory, preferring MCP writes when present |
| `status` | "Is Mem working?", errors | Checks connectivity |

## Knowledge Tree for Agents

Use the Knowledge Filesystem when the task is bigger than a single memory search and you need to browse nearby context.

```text
mem_fs: capabilities
mem_fs: recall "why did we change token refresh?" --in /memories -k 5
mem_fs: cat /memories/by-id/<id>.memory.md
mem_fs: ls /memories/by-label/auth
```

The same surface is available from the shell:

```bash
nmem fs capabilities --json
nmem fs ls /
nmem fs recall "session token strategy" --in /memories -k 5
nmem fs grep "JWT rotation" /memories
```

Use `recall` for fuzzy intent, `find` for metadata, `grep` for exact strings, `stat` before loading large files, and `cat` only after you have a useful path. `grep` is case-insensitive by default; use `--case-sensitive` for exact casing or `-E` for regex. This first release is API-backed; it is not an OS mount yet.

## Prerequisites

`nmem` CLI must be in your PATH.

**Quickest path** (if the Nowledge Mem desktop app is running):
Settings > Preferences > Developer Tools > Install CLI

**Standalone:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version
```

Or `pip install nmem-cli`. On Arch Linux, use the AUR package:

```bash
yay -S nmem-cli
# or: paru -S nmem-cli
```

Then verify with `nmem status`.

## Install

### Home-level (all projects)

Add the Nowledge Community marketplace:

```bash
codex plugin marketplace add nowledge-co/community --sparse .agents --sparse nowledge-mem-codex-plugin
```

Install the package from that marketplace:

```bash
codex plugin add nowledge-mem@nowledge-community
```

If your Codex build still uses the legacy top-level subcommand:

```bash
codex marketplace add nowledge-co/community
```

Prefer the `codex plugin marketplace add ... --sparse ...` command when your Codex build supports it. It avoids cloning the whole community repository, which can time out on slower networks. You can also install it from Codex `/plugins`; the CLI command above is the same marketplace-backed install path.

Then put this in `~/.codex/config.toml` to enable the plugin:

```toml
[features]
plugins = true
hooks = true

[plugins."nowledge-mem@nowledge-community"]
enabled = true
```

Current Codex loads hooks from enabled plugins automatically. Older builds used
a separate `plugin_hooks = true` feature gate; the setup script below detects
that host capability and adds the legacy flag only when it is still required.

Then run the setup script from the installed plugin:

```bash
HOOK_SETUP="$(find ~/.codex/plugins/cache -path '*/nowledge-mem/*/scripts/install_hooks.py' -print 2>/dev/null | sort | tail -1)"
if [ -z "$HOOK_SETUP" ]; then
  echo "Hook setup was not found. Open Codex, run /plugins, install nowledge-mem@nowledge-community, then retry."
else
  python3 "$HOOK_SETUP"
fi
```

On Windows PowerShell, run the same installed script with the Python launcher:

```powershell
$HookSetup = Get-ChildItem "$env:USERPROFILE\.codex\plugins\cache" -Recurse -Filter install_hooks.py |
  Where-Object { $_.FullName -like "*nowledge-mem*" } |
  Sort-Object FullName |
  Select-Object -Last 1
if ($null -eq $HookSetup) {
  Write-Host "Hook setup was not found. Open Codex, run /plugins, install nowledge-mem@nowledge-community, then retry."
} else {
  py -3 $HookSetup.FullName
}
```

This enables Codex lifecycle hooks, adds the legacy plugin-hook gate only on hosts that still expose it, keeps the Nowledge Mem SessionStart, UserPromptSubmit, and Stop hooks enabled in `/hooks`, then installs a small host-level Stop fallback for Codex builds that still need `~/.codex/hooks.json`. SessionStart injects Context Bundle automatically, UserPromptSubmit keeps cross-tool and exact-history work routed to Nowledge search, and Stop shells out to `nmem t save --from codex`. Local mode and remote Mem mode use the same `nmem` client configuration. If both bundled and host-level Stop hooks are visible, the hook runtime suppresses the duplicate save for the same transcript state.

Restart Codex after setup. Codex treats **enabled** and **trusted** as separate hook states: review and trust the three Nowledge Mem hooks when Codex prompts you. This confirmation is deliberately user-owned; the installer never bypasses Codex's hook security boundary.

Raft can run a managed Codex worker on the same computer as your normal Codex sessions. The hook reads Codex's structured `session_meta.originator` for each transcript: normal Codex sessions still capture automatically, while `raft-daemon` rollouts are skipped because they contain Raft inbox/control traffic rather than the human-visible conversation. The legacy `slock-daemon` originator remains supported. Memory skills and MCP remain available inside the Raft worker.

To backfill older Codex sessions, preview first:

```bash
nmem t sync --from codex --all-projects --limit 20
```

Then import:

```bash
nmem t sync --from codex --all-projects --apply
```

Use `-p /path/to/project` instead of `--all-projects` when you only want one project. The command reads local Codex rollout files and writes to the Mem server configured in `nmem`.

On current Codex builds, enabled plugins contribute `hooks/hooks.json` automatically. Older builds may still need `plugin_hooks = true`; the setup script detects that from `codex features list`. In `/hooks`, the Nowledge Mem SessionStart, UserPromptSubmit, and Stop hooks should be both enabled and trusted.

The same setup also asks `nmem` for a Codex MCP config. If `nmem` has a saved API key or a non-default endpoint, the script writes a managed `mcp_servers.nowledge-mem` block into `~/.codex/config.toml`. This is the safest path for remote Mem and for localhost setups that require auth.

The package already includes a local Nowledge Mem MCP server at `http://127.0.0.1:14242/mcp/`. Codex uses your `~/.codex/config.toml` entry if you define `mcp_servers.nowledge-mem` yourself, so remote Mem and custom local ports stay explicit.

If you prefer to copy a bundled example, see [`codex.config.example.toml`](./codex.config.example.toml).

For remote Mem, keep the plugin block and override the bundled MCP server with your server:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
nmem config mcp show --host codex
```

Paste the generated TOML into `~/.codex/config.toml`, or rerun the setup script above if your installed plugin is `0.1.11` or newer. Direct MCP clients do not read `~/.nowledge-mem/config.json` by themselves; the generated block gives Codex the same URL and key that `nmem` already uses.

### Repo-level (this project only)

If you want a repo-pinned local package instead of the shared marketplace source, place the plugin in your repo and create a `marketplace.json`:

```bash
git clone https://github.com/nowledge-co/community.git /tmp/nowledge-community
mkdir -p .agents
cp -r /tmp/nowledge-community/nowledge-mem-codex-plugin ./.agents/nowledge-mem
rm -rf /tmp/nowledge-community
mkdir -p .agents/plugins
```

Create `.agents/plugins/marketplace.json`:

```json
{
  "name": "local",
  "plugins": [
    {
      "name": "nowledge-mem",
      "source": {
        "source": "local",
        "path": "./.agents/nowledge-mem"
      },
      "policy": {
        "installation": "INSTALLED_BY_DEFAULT",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

The path is relative to the repo root, not to the `marketplace.json` file.

You still need the feature gate and plugin entry in `~/.codex/config.toml` (see Home-level above). For this local repo path, the plugin key is:

```toml
[plugins."nowledge-mem@local"]
enabled = true
```

Codex discovers repo-level marketplaces on startup and loads the plugin from that source.

For current stable Codex builds, run the hook setup from the repo-local package too:

```bash
python3 ./.agents/nowledge-mem/scripts/install_hooks.py
```

## Verify

Start a new Codex session and ask: "What was I working on?" The agent should load Context Bundle when full startup context matters, or the Working Memory briefing as the lightweight fallback.

Then test one continuation-style prompt such as "What did we decide before about the OpenClaw release path?" or "Search prior work about this regression." On a healthy plugin + MCP setup, Codex should move beyond the briefing and call Nowledge Mem retrieval tools or the equivalent direct `nmem` search, not stop at the briefing alone.

To verify automatic thread capture, finish a short Codex turn, then run:

```bash
nmem t search "phrase from that Codex turn" --source codex
```

You should see a Codex thread without explicitly asking the agent to save it.

If Mem is not running yet, try `$nowledge-mem:status` to check connectivity.

## Using Codex local Memory too

Codex local Memory and Nowledge Mem can run together, but they serve different scopes:

- Codex local Memory is generated state under one `CODEX_HOME`. It is useful for lightweight local hints.
- Nowledge Mem carries current Working Memory, sourced decisions, exact conversation history, and knowledge across Codex, Claude Code, Gemini, Cursor, and other connected tools.

If you enable Codex local Memory, turn off **Settings > Personalization > Allow memory generation from tool-assisted tasks**. The equivalent config is:

```toml
[memories]
disable_on_external_context = true
```

This prevents tasks that used Nowledge MCP, web search, or tool search from becoming inputs to Codex's separate memory generator. It avoids a duplicate-learning loop in which Codex stores a summary of context it just retrieved from Nowledge, then later answers from that local summary instead of consulting the current cross-tool source. The setup script reports this recommendation when it detects the unsafe combination, but never changes Codex Memory settings for you.

You can also leave Codex local Memory off. Nowledge startup context, search, distillation, and transcript capture continue to work normally.

## Update

If you installed the Codex package before `0.1.13`, refresh the marketplace first. Current Codex builds may refresh the marketplace checkout without reinstalling the already-installed package cache, so the hook setup file or bundled hook changes may still be missing until the package itself is updated.

```bash
(codex plugin marketplace remove nowledge-community || codex marketplace remove nowledge-community || true)
codex plugin marketplace add nowledge-co/community --sparse .agents --sparse nowledge-mem-codex-plugin
codex plugin add nowledge-mem@nowledge-community
```

This intentionally re-adds the marketplace with Codex sparse checkout. Older installs used a full clone of the community repository, and current Codex builds can time out after 30 seconds while refreshing that checkout. You can also update or reinstall `nowledge-mem@nowledge-community` from Codex `/plugins`. Restart Codex after the package is updated.

After the package itself is updated, refresh the host-level hook runtime:

```bash
HOOK_SETUP="$(find ~/.codex/plugins/cache -path '*/nowledge-mem/*/scripts/install_hooks.py' -print 2>/dev/null | sort | tail -1)"
if [ -z "$HOOK_SETUP" ]; then
  echo "Hook setup is still missing. Reinstall nowledge-mem@nowledge-community from Codex /plugins, then retry."
else
  python3 "$HOOK_SETUP"
fi
```

If the marketplace is not registered yet, run:

```bash
codex plugin marketplace add nowledge-co/community --sparse .agents --sparse nowledge-mem-codex-plugin || codex marketplace add nowledge-co/community
```

Restart Codex after updating. If you are on a repo-local `@local` setup, update the local source path instead.

## Remote setup

If Nowledge Mem runs on another machine, save your credentials once:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
```

See [Remote Access](https://mem.nowledge.co/docs/remote-access) for details.

This shared local client config powers the package's direct `nmem` commands, including real `save-thread`. If you override the bundled MCP server in `~/.codex/config.toml`, point it to the same remote Mem server.

To generate the override block without hand-copying credentials:

```bash
nmem config mcp show --host codex
```

## Spaces

Spaces are optional. If one Codex session naturally belongs to one project or agent lane, launch Codex with:

```bash
export NMEM_SPACE="Research Agent"
codex
```

The Context Bundle / Working Memory bootstrap, search-memory skill, save-thread skill, distill-memory skill, and direct `nmem` fallbacks will then stay in that lane automatically.

For multi-agent orchestrators, set `NMEM_AGENT_ID=<agent-slug>` per spawned Codex worker. Add `NMEM_SPACE` only when that run should override the AI Identity's default space. `NMEM_HOST_AGENT_ID` is for advanced external aliases. Context Bundle will use the stable identity while keeping `source_app=codex` for provenance.

Shared spaces, default retrieval, automatic thread capture, and agent guidance come from Mem's own space profile. Codex should choose the ambient lane, not redefine what the space means.

## Project guidance

Copy `AGENTS.md` into your project root for stronger memory behavior in that repo. If you already have an `AGENTS.md`, merge the Nowledge section.

## Customize without editing the plugin

Treat your repo's `AGENTS.md` as the durable override layer for Codex.

- Do not edit the installed package files under the Codex plugin cache.
- Use the package `AGENTS.md` as reference text, then copy or merge only the parts you want into your repo's own `AGENTS.md`.
- Keep the plugin package for defaults and updates; keep your behavior tweaks in the repo you actually work in.

See [`../docs/USER_OVERRIDE_GUIDE.md`](../docs/USER_OVERRIDE_GUIDE.md) for the cross-host policy.

## Migrating from custom prompts

If you used `nowledge-mem-codex-prompts` before:

1. Install this plugin.
2. Remove old prompts: `rm ~/.codex/prompts/{read_working_memory,search_memory,save_session,distill}.md`

| Old prompt | New skill |
|-----------|-----------|
| `read_working_memory` | `$nowledge-mem:working-memory` |
| `search_memory` | `$nowledge-mem:search-memory` |
| `save_session` | `$nowledge-mem:save-thread` |
| `distill` | `$nowledge-mem:distill-memory` |
| *(none)* | `$nowledge-mem:status` |

## Troubleshooting

- **"Command not found: nmem"**: `pip install nmem-cli` or use `uvx --from nmem-cli nmem`. See [Getting Started](https://mem.nowledge.co/docs/installation).
- **"Cannot connect to server"**: Run `nmem status`. For remote setups, check `~/.nowledge-mem/config.json`. See [Remote Access](https://mem.nowledge.co/docs/remote-access).
- **Skills not appearing**: Restart Codex after installing. Verify the marketplace was added, `nowledge-mem@nowledge-community` was installed with `codex plugin add` or from `/plugins`, and `~/.codex/config.toml` has `[features] plugins = true`, `hooks = true`, and `[plugins."nowledge-mem@nowledge-community"] enabled = true`. Older Codex builds may also need `plugin_hooks = true`; rerun setup instead of guessing. If you intentionally use a repo-local marketplace source, use `[plugins."nowledge-mem@local"]`.
- **Startup context or Codex threads are not appearing automatically**: rerun `scripts/install_hooks.py` from the installed plugin folder, restart Codex, then review `/hooks`. The Nowledge Mem SessionStart, UserPromptSubmit, and Stop hooks must be both enabled and trusted. The setup script handles the removed-versus-legacy `plugin_hooks` gate automatically.
- **Stop hook points to an older plugin cache path**: update the package, rerun `scripts/install_hooks.py`, then restart Codex. Already-running Codex sessions can keep the old plugin hook path in memory until restart; current packages prefer the stable host hook when it exists so future updates keep saving cleanly.
- **`codex mcp list` shows `Not logged in`**: update `nmem` so it matches your Mem app/server, install the CLI config from the desktop app if you use local desktop Mem, then rerun `scripts/install_hooks.py`. You can also run `nmem config mcp show --host codex` and paste the generated TOML into `~/.codex/config.toml`. Do not use `codex mcp login nowledge-mem`; that command is for OAuth MCP servers, while Nowledge Mem's Codex path uses the URL and headers generated by `nmem`.
- **Only `codex marketplace` exists, not `codex plugin marketplace`**: use `codex marketplace add nowledge-co/community`. This is a host-version difference, not a plugin issue.
- **Marketplace update times out or fails with `early EOF`**: remove the old full-clone marketplace, then add it back with sparse checkout: `(codex plugin marketplace remove nowledge-community || codex marketplace remove nowledge-community || true) && codex plugin marketplace add nowledge-co/community --sparse .agents --sparse nowledge-mem-codex-plugin && codex plugin add nowledge-mem@nowledge-community`.
- **"plugin is not installed"**: Run `codex plugin marketplace add nowledge-co/community --sparse .agents --sparse nowledge-mem-codex-plugin` (or `codex marketplace add nowledge-co/community` on legacy Codex), install with `codex plugin add nowledge-mem@nowledge-community` or from `/plugins`, then re-check your `~/.codex/config.toml` plugin key.
- **Codex local Memory seems to replace Nowledge retrieval**: update the plugin to `0.1.26` or newer and rerun `scripts/install_hooks.py`. If both memory systems remain enabled, turn off **Allow memory generation from tool-assisted tasks** so Nowledge MCP results are not copied into Codex local Memory.
- **Only startup context loads, but search/distill never show up**: confirm the bundled MCP server is visible in Codex and that the UserPromptSubmit hook is enabled in `/hooks`, then merge the package `AGENTS.md` into the project root for stronger repo-specific behavior. If Mem is remote or not on the default local port, add `mcp_servers.nowledge-mem` in `~/.codex/config.toml` to override the bundled local endpoint.

## Links

- [Codex integration guide](https://mem.nowledge.co/docs/integrations/codex-cli)
- [Documentation](https://mem.nowledge.co/docs)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)
