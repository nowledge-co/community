# Nowledge Mem for Devin

First-class Nowledge Mem integration for Devin CLI, Desktop, and Cloud.

## Install

Devin's native plugin system is currently a closed beta. With access enabled:

```bash
devin plugins install nowledge-co/community#nowledge-mem-devin-plugin
```

The package adds Nowledge Mem skills, a local MCP connection, behavioral
guidance, and lifecycle capture after turns, compaction, and local session end.
Lifecycle sync is silent on success, so hook output never becomes conversation
content; failures remain visible through Devin's hook diagnostics.

On Windows, Devin runs hooks in a POSIX shell, which cannot find the Desktop's
`nmem.cmd` by the bare name `nmem`. The hooks fall back to `nmem.cmd`, so they
work with the command the Desktop installs. If a hook fails with
`nmem: command not found` (exit 127), update the plugin with
`devin plugins update nowledge-mem`. If it fails with
`nmem.cmd: command not found`, no Nowledge Mem CLI is on Devin's PATH: install
or open Nowledge Mem, then restart Devin so it picks up the new PATH.

If you added `nmem` or `nmem.cmd` sync hooks to Devin's own settings by hand
(for example in `%APPDATA%\devin\config.json` or
`~/.config/devin/config.json`), the plugin now registers the same `Stop`,
`PostCompaction`, and `SessionEnd` hooks, and keeping both runs every sync
twice. With plugin 0.1.1 or later installed, back up that file, remove the
manual entries (including any that end in `echo {}`), start a new Devin
session, run one turn, and check that the new session appears in
`nmem t list --source devin`. If it does not, restore the backup. If those
entries passed `--space`, `--space-id`, or `--agent-id`, set `NMEM_SPACE` to
that Space's ID (see `nmem spaces list`) and `NMEM_AGENT_ID` to that identity
in the environment Devin starts with, then restart Devin.

## Verify

```bash
nmem status
nmem t sync --from devin --limit 3
```

Run a short Devin session, then confirm it appears:

```bash
nmem t list --source devin
```

On Windows, run these in PowerShell or Command Prompt, or type `nmem.cmd` in
Git Bash.

## Remote Mem

The bundled MCP entry intentionally targets the loopback desktop service and
contains no credentials. For Nowledge Cloud or another remote Mem server,
generate a user-owned Devin MCP entry:

```bash
nmem config mcp show --host devin
```

Add that entry in Devin **Settings > Connections**. Do not put a shared
organization API key in this repository.

## Enterprise deployment

Account administrators can require the plugin with Devin's managed plugin
manifest:

```json
{
  "requiredPlugins": [
    {
      "source": "git-subdir",
      "url": "https://github.com/nowledge-co/community.git",
      "path": "nowledge-mem-devin-plugin"
    }
  ]
}
```

Cloud command hooks run only while the Devin machine is up. Devin Cloud does not
run `SessionStart` or `SessionEnd` hooks, so enterprise history backfill and
authoritative Cloud synchronization use Devin's read-only v3 session API rather
than pretending hook payloads contain a transcript.

## Privacy and identity

- The importer stores human/Devin messages from the selected message chain. It
  excludes tool payloads, hidden reasoning, and abandoned branches.
- `--agent-id` or `NMEM_AGENT_ID` selects the Nowledge AI identity.
- `--space-id` or `NMEM_SPACE` selects the destination Space.
- Devin user and service-user identifiers are provenance, never inferred as a
  Nowledge identity.
