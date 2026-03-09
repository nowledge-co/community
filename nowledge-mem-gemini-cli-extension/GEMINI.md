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
cat ~/ai-now/memory.md
```

Summarize only the parts that matter for the current task: active projects, priorities, blockers, and the next likely actions.

## Search Memory

Search past knowledge when:

- the current task connects to previous work
- the user asks why a choice was made
- the problem resembles a past bug, design, or workflow

Start with a short retrieval query:

```bash
nmem --json m search "query"
```

If the recall need is conceptual, historical, or the first pass is weak, try a deeper pass:

```bash
nmem --json m search "query" --mode deep
```

Use labels, importance thresholds, or recorded/event-date filters when the task clearly implies them.

If the user is really asking about a previous conversation or session, search threads directly:

```bash
nmem --json t search "query" --limit 5
```

If a memory search result includes `source_thread`, or thread search finds the likely conversation, inspect it progressively instead of loading the whole thread at once:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase `--offset` only when more messages are actually needed.

## Distill Memory

When the conversation produces a durable insight, decision, lesson, or procedure, save an atomic memory with strong metadata:

```bash
nmem --json m add "Insight with enough context to stand on its own." -t "Searchable title" -i 0.8 --unit-type decision -l project-name -s gemini-cli
```

Prefer `decision`, `procedure`, `learning`, `preference`, or `plan` when they fit better than the default `fact`. Use labels only when they materially help retrieval.

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
