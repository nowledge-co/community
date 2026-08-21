# Nowledge Mem for Amp — Reference Guidance

This file is the bundled reference for how the agent should use Nowledge Mem. It mirrors the shipped Amp Skill (`skills/nowledge-mem/SKILL.md`) and the repository-wide [`shared/behavioral-guidance.md`](https://github.com/nowledge-co/community/blob/main/shared/behavioral-guidance.md).

Treat this as reference text. For real, update-safe overrides, use Amp's own instruction surfaces rather than editing this bundled file.

## Tools

| Tool | Purpose |
|------|---------|
| `nowledge_mem_context_bundle` | Startup context: owner identity, AI Identity, active space, rules, Working Memory, KFS paths. |
| `nowledge_mem_working_memory` | Lightweight daily briefing. |
| `nowledge_mem_search` | Search durable knowledge across all tools. Supports label, limit, and deep mode. |
| `nowledge_mem_save` | Save a decision, insight, or preference. |
| `nowledge_mem_update` | Refine an existing memory instead of duplicating it. |
| `nowledge_mem_thread_search` | Search past conversations across all tools. |
| `nowledge_mem_save_thread` | Save the current Amp session as a full thread. Idempotent. |
| `nowledge_mem_save_handoff` | Save a curated handoff summary. |
| `nowledge_mem_graph_expand` | Expand graph neighbours and labelled edges around a memory. |
| `nowledge_mem_status` | Connectivity and configuration diagnostics. |

## Behavioral summary

- At session start, prefer `nowledge_mem_context_bundle`. Use `nowledge_mem_working_memory` only for a lightweight briefing or fallback.
- Search proactively when past context would improve the answer.
- Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked. Search first; if a related memory exists, update it instead of creating a duplicate.
- Use `nowledge_mem_thread_search` for prior conversations and session history.
- Use `nowledge_mem_save_thread` to capture the full session; capture also happens automatically at the end of each agent turn.

## Configuration

The plugin reads the shared Nowledge Mem client config at `~/.nowledge-mem/config.json` and the following environment variables (which take priority):

| Variable | Default | Purpose |
|----------|---------|---------|
| `NMEM_API_URL` | `http://127.0.0.1:14242` | Nowledge Mem server URL (local desktop app or remote). |
| `NMEM_API_KEY` | *(none)* | API key for remote access. |
| `NMEM_SPACE` / `NMEM_SPACE_ID` | *(none)* | Ambient space for this Amp session. |
| `NMEM_AGENT_ID` | *(none)* | Stable Nowledge AI Identity for this run. |
| `NMEM_HOST_AGENT_ID` | *(none)* | Advanced external-alias mapping. |
| `NMEM_AMP_AUTO_SYNC` | `1` | Set to `0`/`false`/`off`/`no` to disable automatic session capture. |
| `NMEM_AMP_AUTO_SYNC_DEBOUNCE_MS` | `1500` | Debounce window for automatic capture. |
| `NMEM_SYNC_TIMEOUT_MS` | `120000` | Automatic thread-sync timeout (1s–30min). Manual save stays at 120s. |

## Customize without editing the plugin

Do not edit this bundled file. Use Amp's own instruction surfaces instead:

- Project rules: `AGENTS.md` in the project root.
- Personal global rules: `~/.config/amp/AGENTS.md`.
- The plugin's behavior is controlled by the environment variables and shared config above.
