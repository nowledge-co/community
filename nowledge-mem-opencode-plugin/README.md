# Nowledge Mem for OpenCode

> Cross-tool knowledge, accessible in every OpenCode session. Your decisions, procedures, and context travel with you.

Nowledge Mem gives OpenCode access to knowledge from all your other AI tools: insights from Claude Code, Cursor, Codex, Gemini, ChatGPT, and every other environment you work in. One knowledge graph, available everywhere.

## What you get

- **Start every session informed.** The plugin can load your Context Bundle at session start: owner identity, AI Identity, active space, active rules, and Working Memory.
- **The agent searches for you.** When past context would improve the answer, OpenCode finds it through your knowledge graph without being asked.
- **Insights stick around.** Key decisions and learnings are saved to Nowledge Mem, ready for any future session in any tool.
- **Sessions are captured automatically.** When OpenCode goes idle after a turn, the plugin saves the conversation as a searchable Mem thread.
- **Resumable handoffs.** Save structured session summaries that any future session in any tool can pick up from.

## Prerequisites

1. **Nowledge Mem desktop app** running (or the server accessible on port 14242)
2. **`nmem` CLI** on your PATH. In Nowledge Mem go to **Settings > Developer Tools > Install CLI**, use `pip install nmem-cli`, or on Arch Linux use `yay -S nmem-cli` / `paru -S nmem-cli`
3. **OpenCode** installed

```bash
nmem status        # Nowledge Mem is running
opencode --version # OpenCode is available
```

## Setup

Add the plugin to your OpenCode config:

```json title="opencode.json"
{
  "plugin": ["opencode-nowledge-mem"]
}
```

Or install globally:

```json title="~/.config/opencode/opencode.json"
{
  "plugin": ["opencode-nowledge-mem"]
}
```

Restart OpenCode to load the plugin.

## Verify

Start a new OpenCode session and ask:

> What was I working on recently?

OpenCode should call `nowledge_mem_context_bundle` when full startup context matters, or `nowledge_mem_working_memory` as the lightweight fallback, then return your current context. If Mem is not running, you will see a connection error in the tool output.

## Update

The plugin follows OpenCode's standard plugin update mechanism. To pin a specific version:

```json
{
  "plugin": ["opencode-nowledge-mem@0.3.5"]
}
```

## Tools

| Tool | What it does |
|------|-------------|
| `nowledge_mem_context_bundle` | Read startup context: owner identity, AI Identity, active space, active rules, Working Memory, and KFS paths. |
| `nowledge_mem_working_memory` | Read today's Working Memory: focus areas, priorities, recent activity. |
| `nowledge_mem_search` | Search knowledge from all your tools. Supports label, date, and deep mode filters. |
| `nowledge_mem_save` | Save a decision, insight, or preference so any tool can find it. |
| `nowledge_mem_update` | Update an existing memory with refined information. |
| `nowledge_mem_thread_search` | Search past conversations from any tool. |
| `nowledge_mem_save_thread` | Save the current session as a full conversation thread (SDK extraction + HTTP). |
| `nowledge_mem_save_handoff` | Save a curated handoff summary (lighter, agent-composed). |
| `nowledge_mem_status` | Check Nowledge Mem server connectivity and diagnostics. |

## How session capture works

Nowledge Mem captures OpenCode sessions in four complementary ways:

1. **Plugin automatic live capture.** When OpenCode reports `session.status=idle` (or the older `session.idle` event), the plugin waits briefly for messages to flush, reads the current session through OpenCode's SDK, and creates or appends the matching `opencode-<sessionID>` thread in Nowledge Mem. This works in local and remote mode because the plugin runs where OpenCode owns the session.

2. **Pre-compaction flush.** Before OpenCode compacts a long session, the plugin saves the current transcript through the same thread path, then reminds the agent to reload Mem context after compaction.

3. **Manual full session capture.** `nowledge_mem_save_thread` uses the same capture path on demand. It is idempotent (safe to call multiple times) and handles large sessions via HTTP, not shell arguments.

4. **Plugin proactive knowledge save.** `nowledge_mem_save` captures individual decisions and insights as they happen, stamped with `source=opencode`. `nowledge_mem_save_handoff` creates a curated summary at wrap-up.

**Desktop backfill note:** The desktop app can still import OpenCode sessions from the local session database in **Threads > Import**. That is a historical/backfill path, not the only live-capture path.

**Remote mode note:** Desktop database polling reads files on the Mem server machine. Plugin automatic capture and `nmem t sync` run on the machine where OpenCode stores the session, then upload to the configured local or remote Mem server.

To backfill older OpenCode sessions, preview first:

```bash
nmem t sync --from opencode --all-projects --limit 20
```

Then import:

```bash
nmem t sync --from opencode --all-projects --apply
```

Use `-p /path/to/project` instead of `--all-projects` when you only want one project. The command reads OpenCode's local session database or legacy JSON storage and writes to the Mem server configured in `nmem`. Historical imports are marked searchable immediately and leave expensive distillation for an explicit review path.

## Hooks

The plugin uses three OpenCode hooks:

- **System prompt injection** (`experimental.chat.system.transform`): teaches the agent when to read Context Bundle, use Working Memory fallback, search proactively, and save autonomously. Active on every turn.
- **Session event capture** (`event`): listens for `session.status=idle` and legacy `session.idle`, debounces briefly, then saves the current session as a Mem thread with stable dedupe metadata.
- **Compaction resilience** (`experimental.session.compacting`): flushes the current transcript before compaction and injects a reminder to restore Nowledge Mem context after long sessions trigger context compaction. Ensures the agent doesn't lose awareness of your knowledge tools.

For project-specific behavioral guidance, add to your `AGENTS.md` or OpenCode instructions. The included `AGENTS.md` in this package serves as a reference.

## Customize without editing the plugin

OpenCode already gives you a proper instruction layer.

- Shared repo rules: `AGENTS.md`
- Personal global rules: `~/.config/opencode/AGENTS.md`
- Reusable extra files: list them in `opencode.json` `instructions`
- Do not edit the installed plugin bundle directly

Treat the package `AGENTS.md` as reference text and keep your real overrides in OpenCode's own instruction files.

## Configuration

No config needed for local use.

| Env Variable | Default | What it does |
|-------------|---------|-------------|
| `NMEM_API_URL` | *(local)* | Remote Nowledge Mem server URL |
| `NMEM_API_KEY` | *(none)* | API key for remote access |

The plugin also reads `~/.nowledge-mem/config.json` (shared with all Nowledge Mem integrations). Environment variables take priority.

### Remote access

```json title="~/.nowledge-mem/config.json"
{
  "apiUrl": "https://your-server",
  "apiKey": "your-key"
}
```

That shared config is used by both the `nmem` command paths and the HTTP session-save path.

See [Access Mem Anywhere](https://mem.nowledge.co/docs/remote-access).

### Spaces

Spaces are optional. If one OpenCode process naturally belongs to one project or agent lane, set it once in the shared Mem client config:

```json title="~/.nowledge-mem/config.json"
{
  "space": "Research Agent"
}
```

You can also launch OpenCode with an explicit lane:

```bash
NMEM_SPACE="Research Agent" opencode
```

The plugin's Context Bundle, Working Memory, search, save, and full-session thread save paths will follow that lane. Environment variables take priority over the shared config. If you do not have a real ambient lane, stay on `Default`.

For multi-agent orchestrators, set `NMEM_AGENT_ID=<agent-slug>` per spawned OpenCode worker. Add `NMEM_SPACE` only when that run should override the AI Identity's default space. `NMEM_HOST_AGENT_ID` is for advanced external aliases. Context Bundle will use the stable identity while keeping `source_app=opencode` for provenance.

Shared spaces, default retrieval, and agent guidance still come from Mem's own space profile. OpenCode should pick the lane once, not invent a second plugin-local memory partition.

## Troubleshooting

- **nmem not found.** Install with `pip install nmem-cli`, or on Arch Linux `yay -S nmem-cli` / `paru -S nmem-cli`, then run `nmem status` to verify.
- **Server not responding.** Start the Nowledge Mem desktop app, or check `nmem status` for diagnostics.
- **Plugin not loading.** Confirm `"opencode-nowledge-mem"` appears in your `opencode.json` plugin array. Restart OpenCode after changes.

## Links

- [OpenCode integration guide](https://mem.nowledge.co/docs/integrations/opencode)
- [Documentation](https://mem.nowledge.co/docs/integrations)
- [Discord](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

Made with care by [Nowledge Labs](https://nowledge-labs.ai)
