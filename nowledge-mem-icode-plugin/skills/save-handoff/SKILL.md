---
name: save-handoff
description: Write a structured resumable handoff from an iCode session into Nowledge Mem. Use at session end, before major context switches, or when the user says "save this session". This is a summary handoff, not a full transcript import.
---

Save a resumable summary so the next session — in iCode or any other tool —
can pick the work back up.

iCode has no registered Nowledge transcript parser yet, so this skill saves an
explicit handoff summary via `memory_add` (MCP) or `nmem m add` (CLI). It is a
summary, not lossless thread capture; do not describe it as a full transcript
save.

## Handoff structure

Title: `Handoff: <short task name> (<date>)`

Content:

1. **Goal** — what this session set out to do
2. **State** — what is done, what is in flight (exact files, branches, PRs,
   commands, versions)
3. **Next steps** — the concrete actions the next session should take, in order
4. **Watch out** — pitfalls discovered, decisions made and why, open questions

Keep it under ~40 lines; link exact paths and identifiers rather than
paraphrasing them.
