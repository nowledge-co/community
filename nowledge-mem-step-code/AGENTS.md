# Nowledge Mem for Step Code

Use the installed Nowledge Mem skills and `nmem` CLI when prior context would improve the work.

- Context Bundle or Working Memory is injected before the first agent turn. Do not read it again unless the user asks or the session context changes.
- Search memories for durable decisions, procedures, preferences, and learnings. Search threads for prior conversations and exact source context.
- Search before saving. Update an existing memory when new information refines the same idea; otherwise save a concise durable memory.
- The extension automatically syncs completed Step Code conversations after `agent_settled`. Use `save-thread` only when the user asks for an additional curated handoff.
- Keep transcript provenance as `source_app=step-code`. Set `NMEM_AGENT_ID` only when this Step Code process intentionally represents a durable Nowledge AI Identity.
- Use `NMEM_SPACE` only when the whole process belongs to one ambient lane. Prefer explicit per-command scope when the work crosses spaces.

Useful checks:

```bash
nmem status
nmem --json m search "query"
nmem --json t search "query" --limit 5
nmem t list --source step-code -n 5
```
