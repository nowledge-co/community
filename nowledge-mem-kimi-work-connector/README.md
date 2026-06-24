# Nowledge Mem for Kimi Work

Connect Kimi Work Desktop to Nowledge Mem. Kimi Work can read your current context, search and save memories through MCP, and import Kimi Work conversations into Mem Threads when you run `nmem t sync --from kimi-work`.

Kimi Work is separate from the Kimi Code CLI you may have installed yourself. It uses a private embedded Kimi Code runtime, so `~/.kimi-code` and the Kimi Code plugin install do not affect Kimi Work.

## What You Get

- Startup guidance that tells Kimi Work when to read Context Bundle or Working Memory.
- A bundled local MCP declaration for Mem running at `http://127.0.0.1:14242/mcp/`.
- CLI fallback for memory search, save, status, and thread search.
- Historical Kimi Work conversation import with `nmem t sync --from kimi-work`.

Kimi Work does not expose lifecycle hooks today. This connector cannot auto-capture every turn. Use the sync command when you want Kimi Work history in Mem Threads.

## Requirements

1. Nowledge Mem desktop app running locally, or a reachable remote Mem server.
2. Kimi Work Desktop installed.
3. `nmem` 0.9.23 or newer on the same machine as Kimi Work.

If Nowledge Mem Desktop is on this machine, `nmem` is usually ready from the app:

```bash
nmem status
nmem --version
```

If Kimi Work runs on a different machine, install the standalone CLI there:

```bash
python3 -m pip install --user nmem-cli
nmem status
nmem --version
```

For remote Mem, configure the local `nmem` client on the Kimi Work machine:

```bash
nmem config client set url https://your-mem-server
nmem config client set api-key your-key
```

## Install

Get the community checkout if you do not already have it:

```bash
git clone --depth 1 https://github.com/nowledge-co/community.git ~/.cache/nowledge-community
```

Install the connector into Kimi Work's embedded runtime:

```bash
python3 ~/.cache/nowledge-community/nowledge-mem-kimi-work-connector/scripts/install_kimi_work_plugin.py
```

The installer:

- Detects `KIMI_WORK_HOME` when set.
- Otherwise uses the macOS Kimi Work runtime at `~/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/kimi-code/home`.
- Copies this connector to `plugins/managed/nowledge-mem`.
- Updates `plugins/installed.json` without removing other plugins.
- Preserves existing Nowledge Mem enabled state and MCP enablement when rerun.

Restart Kimi Work after installing.

## Remote Mem Or Authenticated Localhost

The bundled MCP entry points at the local desktop app. For remote Mem, generate a Kimi Work MCP block:

```bash
nmem config mcp show --host kimi-work
```

Paste the generated `nowledge-mem` server into:

```bash
"$KIMI_WORK_HOME/mcp.json"
```

If `KIMI_WORK_HOME` is not set, the default macOS path is:

```text
~/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/kimi-code/home/mcp.json
```

Restart Kimi Work after changing MCP config.

## Verify

Start a new Kimi Work session and ask:

```text
Is Nowledge Mem connected? Read my current context.
```

Success means Kimi Work can return Context Bundle, Working Memory, or an empty-but-successful memory result.

Then import a small preview of local sessions:

```bash
nmem t sync --from kimi-work --limit 10
```

When the preview looks right:

```bash
nmem t sync --from kimi-work --apply
nmem t list --source kimi-work -n 5
```

## Import A Specific Runtime Folder

If Kimi Work stores sessions somewhere else, pass that folder explicitly:

```bash
nmem t sync --from kimi-work \
  --session-dir "/path/to/kimi-work/home/sessions" \
  --apply
```

This works for local and remote Mem because the CLI reads Kimi Work's local files and uploads normalized messages to the Mem server configured in `nmem`. Reruns are safe: thread IDs and message IDs are stable, and Mem deduplicates repeated imports.

## Update

```bash
git -C ~/.cache/nowledge-community pull --ff-only
python3 ~/.cache/nowledge-community/nowledge-mem-kimi-work-connector/scripts/install_kimi_work_plugin.py
```

Restart Kimi Work after updating.

## Links

- [Kimi Work guide](https://mem.nowledge.co/docs/integrations/kimi-work)
- [All Connectors](https://mem.nowledge.co/docs/integrations)
- [Nowledge Mem](https://mem.nowledge.co)

## Credits

Thanks to [Versun](https://github.com/versun) for discovering Kimi Work's embedded Kimi runtime and contributing the first connector draft.
