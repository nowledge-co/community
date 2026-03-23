---
name: save-thread
description: Deprecated compatibility skill. In generic npx skills environments this must degrade honestly to a resumable handoff, because real transcript-backed thread import is not guaranteed. Prefer save-handoff here, and use native integrations when you need actual session capture.
---

# Save Thread (Deprecated Compatibility)

> Preserve the old skill name without pretending a generic skill runtime can always import the real session transcript.

## Status

This skill name is **deprecated** and kept only for compatibility.

Use `save-handoff` for generic `npx skills` environments.

## Why This Cannot Promise Real Thread Save

A shared skills package works across many agent runtimes. In many of them, a skill can influence prompting but cannot read the host agent's real session transcript through a stable programmatic API.

That means this package must not promise a lossless thread import when the runtime may not expose:

- readable session files
- a transcript/history API
- a native importer surface wired for that specific agent

If we claimed real thread save here, users would believe later retrieval reflects the actual full session when it may only contain a summary.

## What To Do Instead

In generic skill environments, treat `save-thread` as an alias for `save-handoff`:

- save a concise resumable handoff with `nmem t create`
- state clearly that this is a handoff summary, not a transcript-backed import
- never present the result as the full original session

## When Real Thread Save Is Feasible

Use a dedicated native integration when the runtime has a real transcript importer.

Examples include Nowledge integrations such as:

- Gemini CLI
- Claude Code

In those environments, `nmem t save --from <runtime>` can read local session files on the client machine and upload normalized thread messages to Mem.

## When To Use Which Save Surface

Use **save-handoff** when:

- you are in a generic `npx skills` environment
- you want a restart point, checkpoint, or concise continuation summary
- the runtime does not have a proven native thread importer

Use a native **save-thread** only when:

- the agent has a dedicated Nowledge integration for that runtime
- real transcript import is actually implemented for that runtime
- you want the actual session captured for later search and inspection

## Usage In Generic Skills Environments

Create a structured handoff instead of pretending to save the real thread:

```bash
nmem --json t create   -t "Session Handoff - <topic>"   -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..."   -s generic-agent
```

## Response Format

After successful save in a generic skills environment:

```
✓ Handoff saved
Title: {title}
Summary: {content}
Thread ID: {thread_id}
```

Always explain that this compatibility skill creates a resumable handoff, not a real transcript import.

## Native Plugin

These skills work in any agent via CLI. For auto-recall, auto-capture, and graph tools, check if your agent has a native Nowledge Mem plugin — run the `check-integration` skill or see https://mem.nowledge.co/docs/integrations
