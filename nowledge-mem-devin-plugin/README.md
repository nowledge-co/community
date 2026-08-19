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

## Verify

```bash
nmem status
nmem t sync --from devin --limit 3
```

Run a short Devin session, then confirm it appears:

```bash
nmem t list --source devin
```

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
