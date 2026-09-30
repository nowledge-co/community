# OpenHands Agent Memory Contract

This plugin provides persistent, cross-agent memory for OpenHands and OpenHands SDK workflows.

## Environment Variables

- `NMEM_API_URL`: Nowledge Mem REST API endpoint (default: `http://127.0.0.1:14242`).
- `NMEM_API_KEY`: API key for authenticated or remote Mem deployments.
- `NMEM_SPACE`: Space name to route memories, threads, and working memory to.
- `NMEM_AGENT_ID`: Agent or worker node identifier (e.g. `planner`, `coder`, `reviewer`).
- `NMEM_DISABLE_PROMPT_INJECT`: Set to `1` to suppress automatic Context Bundle injection in `UserPromptSubmit`.
- `NMEM_DISABLE_AUTO_CAPTURE`: Set to `1` to suppress automatic thread capture on `Stop`.

## Agent Skills

- `read-working-memory`: Load context bundle or working memory daily briefing.
- `search-memory`: Recall past decisions, lessons, and solutions.
- `distill-memory`: Autonomous memory capture: save durable facts and decisions proactively.
- `save-handoff`: Checkpoint progress between workflow nodes or agent handoffs.
- `save-thread`: Synchronize session thread to Nowledge Mem.
- `status`: Diagnostic check for connectivity, version, and spaces.
- `check-integration`: Guide setup and troubleshoot plugin.

## Lifecycle Hooks

- `UserPromptSubmit`: Injects Context Bundle or Working Memory on prompt submission.
- `PostToolUse`: Monitors file changes and workspace updates.
- `Stop`: Gracefully records conversation session upon task completion.

## Multi-Agent & Orchestrator Capture Control

When OpenHands coordinates multi-agent workflows or child workers:
- **Child-Authoritative Mode**: If child worker processes capture their own threads or if raw execution traces should be captured externally, set `NMEM_DISABLE_AUTO_CAPTURE=1` in OpenHands to suppress top-level session capture on Stop.
- **Host-Authoritative Mode (Default)**: OpenHands captures the canonical thread on session completion. For child tools/processes, configure orchestrator boundaries or connector-specific capture options as supported by each runtime.
- **Node Provenance**: Always pass `NMEM_AGENT_ID=<role>` (e.g. `planner`, `coder`, `reviewer`) to distinguish node identity.
- **Space Isolation**: Pass `NMEM_SPACE=<space-slug>` for project-level isolation.

## Architecture & Tiered Resilience

- **Event Ingestion**: `hooks/nmem_shared.py` reads discrete OpenHands event logs (`events/event-*.json`), strips execution churn, deduplicates turns, and normalizes into chat messages.
- **3-Tier Sync**: Fast REST (`POST /threads/import`) -> CLI fallback (`nmem t import`) -> File-locked offline queue (`unsynced.json`) with auto-drain on subsequent runs.

