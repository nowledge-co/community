# Nowledge Mem for MiniMax

Persistent, cross-tool memory for MiniMax Code and MiniMax Agent.

## Capability model

| Surface | Connection | Available after install |
| --- | --- | --- |
| MiniMax Code | Local Streamable HTTP MCP at `127.0.0.1:14242` | Context Bundle, Working Memory, recall, durable memory writes, thread search, and graph and artifact tools exposed by the user's Mem instance |
| MiniMax Agent | MiniMax-managed App/Connector to Nowledge Cloud | Available only after MiniMax Marketplace App approval and provider configuration; once enabled, it follows the same core context, recall, write, and search workflow scoped to the connected Cloud member and Agent identity |

The desktop MCP entry contains no credential. Cloud credentials must be collected and stored by MiniMax's managed connection flow; they are never part of this repository or plugin package.

## Requirements

- MiniMax Code: Nowledge Mem is installed and running on the same computer.
- MiniMax Agent: a Nowledge Cloud workspace and the Nowledge Mem App connection supplied by MiniMax Marketplace. The App/Connector is a separate MiniMax catalog integration; it is not represented as a fake MCP header or an embedded credential in this package.

## Thread capture

The marketplace plugin searches existing Threads and saves explicit resumable handoffs. For a local MiniMax Code installation, see the [optional Bridge startup plugin](../docs/BRIDGE_HOST_HOOKS.md#optional-local-adapters).

## Source and support

- Product: https://mem.nowledge.co
- Documentation: https://mem.nowledge.co/docs
- Support: https://nowled.ge/discord

Licensed under the repository's MIT license.
