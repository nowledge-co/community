# Nowledge Mem for WorkBuddy

Bring current context and exact prior work into Tencent WorkBuddy, then keep new WorkBuddy conversations searchable across every AI tool connected to Nowledge Mem.

## What It Does

- Loads your current Context Bundle when a WorkBuddy session starts.
- Routes continuation, prior-decision, preference, regression, and exact-history work to Nowledge Mem.
- Exposes structured memory and thread tools through MCP.
- Captures main-agent and subagent transcripts at WorkBuddy lifecycle boundaries.
- Adds `/nowledge-mem:status`, `/nowledge-mem:sync-now`, and `/nowledge-mem:import-history`.
- Keeps hook failures quiet so an unavailable Mem service never blocks WorkBuddy.

## Requirements

1. Nowledge Mem desktop running locally, or a reachable remote Mem server.
2. A WorkBuddy release with plugin hooks.
3. A current `nmem` CLI on the WorkBuddy machine.

For the desktop-bundled CLI, open Mem and use **Settings -> Preferences -> Developer Tools -> Install bundled CLI**. Standalone users can upgrade `nmem-cli` through their existing Python or pipx installation.

For remote Mem:

```bash
nmem config client set url https://your-mem-server
nmem config client set api-key your-key
```

## Install

In **WorkBuddy desktop**, open **Plugins -> +** (插件 -> +), paste this marketplace address, then find **Nowledge Mem** in **nowledge-community** and click **Install**:

```text
https://raw.githubusercontent.com/nowledge-co/community/main/.workbuddy-plugin/marketplace.json
```

Check that the plugin and its skill are enabled. Reload or restart WorkBuddy, open its MCP/Connections settings, and review **Trust** for the `nowledge-mem` connector if requested. Trust is a user security decision; an agent must not approve it silently. This is the [official desktop marketplace flow](https://www.codebuddy.cn/docs/workbuddy/Plugins).

Only if your host exposes plugin slash commands, the equivalent command path is:

```text
/plugin marketplace add https://raw.githubusercontent.com/nowledge-co/community/main/.workbuddy-plugin/marketplace.json --name nowledge-community
/plugin install nowledge-mem@nowledge-community
```

Use the raw WorkBuddy marketplace URL exactly as shown. Current WorkBuddy releases check `.codebuddy-plugin` before `.workbuddy-plugin` at a repository root, so adding `nowledge-co/community` directly can select the CodeBuddy package.

For an ordinary update, use **Update** on the installed plugin card and reload; do not remove the marketplace. If you have confirmed that an old repository-root marketplace installed the **CodeBuddy** package instead, migrate that specific wrong entry once (this is not the normal update procedure):

```text
/plugin marketplace remove nowledge-community
/plugin marketplace add https://raw.githubusercontent.com/nowledge-co/community/main/.workbuddy-plugin/marketplace.json --name nowledge-community
/plugin install nowledge-mem@nowledge-community
```

Removing the old marketplace clears its enabled entry; the final install restores it from the dedicated WorkBuddy package. Restart or reload WorkBuddy after installation.

The bundled MCP endpoint targets local Mem. For remote Mem or authenticated localhost, generate a user-owned override:

```bash
nmem config mcp show --host workbuddy
```

In desktop WorkBuddy, add or edit `nowledge-mem` through **Connections / MCP** and preserve the generated URL and all headers. Review its Trust/enable state after saving. The bundled local connection declares `x-nmem-space-protocol: exact-v1`; the generated override must preserve that declaration too.

Do not assume that writing `~/.workbuddy/.mcp.json` by itself registers a connector in the desktop UI. That file belongs to a CLI/project configuration path on hosts that support it; it is not evidence of desktop activation. Do not edit the installed plugin cache or register a second competing endpoint without disabling the old one.

## If installation reports success but nothing appears

Check the **Plugins** marketplace list first: is `nowledge-community` present with the raw URL above, and is Nowledge Mem installed and enabled? Then check **Skills** and **Connections / MCP** separately. If slash commands produced only chat text rather than a plugin-management result, use the desktop UI path above. Reload, review the connector Trust request, and verify an actual memory search before declaring setup complete.

If the desktop marketplace path still fails, report the WorkBuddy version, OS, the add/install error and whether the marketplace is visible. Do not paste credentials or raw session logs.

As a temporary, reduced-capability fallback, install `skills/nowledge-mem/SKILL.md` as a user skill through WorkBuddy's Skills interface (or copy the skill directory to `~/.workbuddy/skills/nowledge-mem/`), then add the generated MCP block through Connections. Enable the skill and explicitly Trust MCP, then restart. This gives memory tools and guidance, **not automatic lifecycle capture**: copying a skill and registering MCP does not install plugin hooks. Use manual `nmem t sync --from workbuddy` preview/import when needed.

## Automatic Thread Capture

WorkBuddy provides `session_id` and the exact local transcript path to plugin hooks. The connector syncs at:

- `PreCompact`, before context compression
- `Stop`, after a completed turn
- `SubagentStop`, after delegated work
- `SessionEnd`, when the session closes

The hook enqueues capture through the shared CLI queue:

```bash
nmem --json t capture --from workbuddy --session-id <session-id> --transcript-path <transcript_path> --sync --all-projects
```

The `enqueued` acknowledgement means durable queue acceptance, not completed upload. Check the resulting Thread in Mem. Imports are idempotent; repeated lifecycle events update the same WorkBuddy thread and deduplicate messages.
For `SubagentStop`, WorkBuddy reports the parent session separately from `agent_id`; the connector uses the subagent's own ID so delegated transcripts cannot collide with the parent thread's message IDs.

## Verify

Start a new WorkBuddy session and ask it to read your current context and search for a known memory. A successful `nmem doctor` in a terminal only proves CLI connectivity, not that WorkBuddy's MCP connector is enabled and trusted. With the full plugin installed, complete a short exchange, then run:

```bash
nmem t list --source workbuddy -n 5
```

Hook diagnostics are stored in WorkBuddy's plugin data directory. Older hosts fall back to:

```bash
tail -n 50 ~/.workbuddy/logs/nowledge-mem-hook.log
```

## Older Sessions

Preview first:

```bash
nmem t sync --from workbuddy --limit 20
```

Then import:

```bash
nmem t sync --from workbuddy --apply
```

The CLI reads `$WORKBUDDY_CONFIG_DIR/projects` or `~/.workbuddy/projects` locally and uploads normalized threads to the configured Mem server.

## Customize

Keep personal behavior in `~/.workbuddy/CODEBUDDY.md`, a project `CODEBUDDY.md`, or `.workbuddy/rules/*.md`. Do not edit installed plugin files; marketplace updates replace them.

## Links

- [WorkBuddy guide](https://mem.nowledge.co/docs/integrations/workbuddy)
- [All connectors](https://mem.nowledge.co/docs/integrations)
- [Nowledge Mem](https://mem.nowledge.co)
