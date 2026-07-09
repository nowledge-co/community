# Nowledge Mem for Craft Agent

Craft Agent supports workspace sources and skills. This connector uses those
native surfaces:

- a `nowledge-mem` MCP source for memory search, reads, and writes
- a workspace guide/skill that teaches Craft Agent when to use Mem
- `nmem t save/sync --from craft-agent` for real transcript import from
  Craft's local `session.jsonl` files

Craft does not currently need a published npm package for this connector. The
source and guide live in each Craft workspace.

## Install

Generate the Craft source config from the same Mem client settings used by the
CLI:

```bash
nmem config mcp show --host craft-agent
```

Create this folder in the Craft workspace you want to connect:

```text
~/.craft-agent/workspaces/<workspace>/sources/nowledge-mem/
```

Then save the generated `sourceConfig` JSON as:

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

Configure the local client first:

```bash
nmem config client set url https://your-mem-server
nmem config client set api-key nmem_...
nmem config mcp show --host craft-agent
```

Paste the regenerated source config into Craft Agent. Thread import still runs
on this machine because this is where Craft stores the transcripts; the CLI then
uploads normalized threads to your configured Mem server.

