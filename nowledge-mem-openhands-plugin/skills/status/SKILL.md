---
name: status
description: Check Nowledge Mem connection status, server version, active space, and CLI diagnostics in OpenHands.
trigger:
  type: keyword
  keywords:
    - status
    - health
    - ping
    - connection
    - check memory
---

# Status

> Diagnostic check for Nowledge Mem connectivity and configuration in OpenHands.

## When to Use

- User asks "is my memory working?", "check status", or "ping memory"
- Memory tools return unexpected connection errors
- First-time setup verification in OpenHands or SDK
- Switching between local and remote Mem endpoints

## Usage

### Via CLI

```bash
nmem --json status
```

Output includes:
- **Connection**: `reachable` or error details
- **Server version**: Backend server version
- **Active space**: Current workspace space
- **Configured identity**: Current AI Identity

To check detailed space roster:

```bash
nmem --json spaces list
```

### Via MCP

Call `graph_stats()`:

```json
graph_stats()
```

Returns total memories, relations, entities, and communities in the active knowledge graph.
