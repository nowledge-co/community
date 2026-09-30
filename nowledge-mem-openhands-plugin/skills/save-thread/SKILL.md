---
name: save-thread
description: Synchronize and persist the active OpenHands conversation session or multi-agent canvas run into Nowledge Mem.
trigger:
  type: keyword
  keywords:
    - save thread
    - save session
    - sync thread
    - export session
---

# Save Thread

> Synchronize the active OpenHands conversation session or multi-agent canvas run into Nowledge Mem.

## When to Use

- Explicit user request: "save this conversation", "record this thread in nowledge mem".
- Automated Stop hook: runs automatically upon agent completion if `NMEM_DISABLE_AUTO_CAPTURE` is not set.
- Checkpoint before long-running background tasks.

## How Thread Capture Works in OpenHands

OpenHands persists conversation events to disk (`events/event-*.json`). The Nowledge Mem OpenHands plugin integrates via a Tier-2 native transcript importer:

1. **Automated Stop Hook**:
   When a conversation ends or agent pauses, `hooks/nmem-stop.py` runs automatically:
   - Locates the active OpenHands session events on disk.
   - Extracts and deduplicates user prompts and assistant actions/observations.
   - Synchronizes directly to Nowledge Mem via high-speed REST API `POST /threads/import` (with CLI `nmem t import` fallback and offline queue resilience).

2. **Explicit Session Sync**:
   To manually checkpoint the current session from terminal or canvas:
   ```bash
   python3 <plugin-dir>/hooks/nmem-stop.py <<<'{"session_id": "<conversation-id>"}'
   ```
   Or using the `nmem` CLI import:
   ```bash
   nmem t import --id "openhands-<conversation-id>" --title "<title>" --messages '<json>' --source openhands
   ```

3. **Multi-Agent Canvas Provenance**:
   When running multiple agents on a canvas, configure `NMEM_AGENT_ID` and `NMEM_SPACE` so thread captures preserve individual node provenance across the shared graph.

4. **Multi-Agent Orchestrator Capture Control**:
   When orchestrating multi-agent workflows or child processes, you can control thread capture boundaries. If child tasks or workers capture their own threads, set `NMEM_DISABLE_AUTO_CAPTURE=1` in OpenHands to prevent duplicate session captures while keeping MCP memory tools active.
