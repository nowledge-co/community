---
name: read-working-memory
description: Load the Nowledge Mem daily briefing and Context Bundle at session start in iCode, covering current priorities, recent decisions, and active space. Use when a session begins, when the startup reminder is missing, or when the user asks what they were working on.
---

Load the user's current context at the start of an iCode session.

The user_prompt_submit hook injects the Context Bundle as a system reminder on
the first prompt of a session. When that reminder is missing or the user asks
to refresh it, load it yourself:

1. Prefer the Nowledge Mem MCP `read_context_bundle` tool when it is loaded in
   this session (it covers owner identity, agent lane, active space, rules,
   and Working Memory).
2. Otherwise run `nmem context`, falling back to `nmem working-memory`.

Do not stop at the startup context if the task clearly resumes prior work —
follow up with the search-memory skill for the specific topic.
