# Nowledge Mem for Craft Agent

The bundled local MCP connection requires nmem 0.10.126 or later with `nmem mcp`. Restart the host session after changing your Mem connection.

Craft Agent supports workspace sources and skills. This connector uses those
native surfaces:

- a `nowledge-mem` MCP source for memory search, reads, and writes
- a workspace guide/skill that teaches Craft Agent when to use Mem
- `nmem t save/sync --from craft-agent` for real transcript import from
  Craft's local `session.jsonl` files

Craft does not currently need a published npm package for this connector. The
source and guide live in each Craft workspace.

## Install

Start with [source-config.example.json](source-config.example.json). It runs `nmem mcp` and contains no URL or key. Ensure `nmem mcp --help` works on the computer running Craft Agent.

Create this folder in the Craft workspace you want to connect:

```text
~/.craft-agent/workspaces/<workspace>/sources/nowledge-mem/
```

Save the example JSON in that folder as:

```text
sources/nowledge-mem/config.json
```

Save `guide.md` from this directory as:

```text
sources/nowledge-mem/guide.md
```

Restart Craft Agent or reload the workspace, then ask Craft Agent to use the
Nowledge Mem source to read Working Memory or search memory.

## Import Craft Agent Threads

Preview older local sessions:

```bash
nmem t sync --from craft-agent --all-projects --limit 20
```

Import them:

```bash
nmem t sync --from craft-agent --all-projects --apply
```

Save the latest session for the current project:

```bash
nmem t save --from craft-agent
```

The importer reads Craft session files from:

```text
~/.craft-agent/workspaces/*/sessions/*/session.jsonl
```

If your Craft config is elsewhere, set `CRAFT_CONFIG_DIR` or pass
`--session-dir <path>` to `nmem t sync`.

## Remote Mem

Configure nmem on the computer running Craft and start a new Craft session. The stdio source follows that connection; do not regenerate the source or add a key to it. Thread import still runs on the computer holding Craft's transcripts.

If you intentionally need a standalone HTTP source, inspect `nmem config mcp show --host craft-agent` and configure Craft's credentials privately. A direct HTTP source is tied to that address and does not follow workspace changes.
