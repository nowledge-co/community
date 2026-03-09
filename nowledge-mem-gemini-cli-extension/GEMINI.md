# Nowledge Mem for Gemini CLI

You have access to the user's Nowledge Mem through the `nmem` CLI.

This integration is intentionally CLI-first. Use the bundled commands when convenient, but compose direct `nmem` commands whenever that is clearer, more precise, or more efficient.

## Core Memory Lifecycle

Treat Nowledge Mem as four linked surfaces:

1. Working Memory for current focus and active priorities
2. Distilled memories for durable knowledge
3. Threads for full searchable conversation history
4. Handoff summaries for compact resumability when the user wants a manual handoff

Prefer the smallest surface that answers the user's need, then move upward only when more context is necessary.

## Connection Model

`nmem` resolves remote access in this order:

1. `--api-url` flag
2. `NMEM_API_URL` / `NMEM_API_KEY`
3. `~/.nowledge-mem/config.json`
4. local defaults

Preferred persistent remote setup:

```json
{
  "apiUrl": "https://mem.example.com",
  "apiKey": "nmem_your_key"
}
```

Save it to:

```text
~/.nowledge-mem/config.json
```

## Working Memory

At the start of a session, or when recent priorities would help, read Working Memory with:

```bash
nmem --json wm read
```

If the command succeeds but returns `exists: false`, there is no Working Memory briefing yet. Say that clearly instead of pretending a briefing exists.

Only fall back to the legacy file below for older local-only setups where the user still keeps Working Memory there:

```bash
test -f ~/ai-now/memory.md && cat ~/ai-now/memory.md
```

Read Working Memory once near the start of a session, then reuse that context mentally. Do not re-read on every turn unless the user asks, the session context changed materially, or a long-running session clearly needs a refresh.

## Search Memory

Search past knowledge when:

- the user references previous work, a prior fix, or an earlier decision
- the task resumes a named feature, bug, refactor, incident, or subsystem
- a debugging pattern resembles something solved earlier
- the user asks for rationale, preferences, procedures, or recurring workflow details
- the current result is ambiguous and prior context would make the answer sharper

Start with durable recall:

```bash
nmem --json m search "query"
```

If the recall need is conceptual or the first pass is weak, use deep search:

```bash
nmem --json m search "query" --mode deep
```

If the user is really asking about a previous conversation or session, search threads directly:

```bash
nmem --json t search "query" --limit 5
```

If a memory search result includes `source_thread`, or thread search finds the likely conversation, inspect it progressively instead of loading the whole thread at once:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Prefer the smallest retrieval surface that answers the question.

## Distill Memory

Distill only durable knowledge worth keeping after the current session ends.

Use `memory_add` for genuinely new decisions, procedures, lessons, preferences, or plans:

```bash
nmem --json m add "Insight with enough context to stand on its own." -t "Searchable title" -i 0.8 --unit-type decision -l project-name -s gemini-cli
```

If an existing memory already captures the same decision, workflow, or preference and the new information refines it, update that memory instead of creating a duplicate:

```bash
nmem m update <id> -t "Updated title"
```

## Save Thread

Only save a thread when the user explicitly asks to persist the real Gemini session. The extension also performs a best-effort automatic thread import on session end, so this command is mainly for explicit mid-session capture or immediate confirmation.

This is a real session import, not a summary fallback. Use:

```bash
nmem --json t save --from gemini-cli -p . -s "Brief summary of what was accomplished"
```

The summary is metadata only. The saved thread should come from Gemini's recorded session transcript.

If the user wants a specific older Gemini session, add `--session-id`.

## Save Handoff

Only save a handoff when the user explicitly asks for a resumable summary rather than a full session import. Think of this as a handoff summary, not a transcript save.

Structure the checkpoint around:

- Goal
- Major decisions
- Files or surfaces touched
- Open questions or risks
- Next steps

Then store it with:

```bash
nmem --json t create -t "Gemini CLI Session - topic" -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." -s gemini-cli
```

## Status

When setup seems broken, run:

```bash
nmem status
```

Be concise, use memory tools naturally, and avoid saving routine or low-value chatter.
