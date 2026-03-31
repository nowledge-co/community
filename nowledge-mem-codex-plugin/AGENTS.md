# Nowledge Mem for Codex

You have access to the user's Nowledge Mem through the `nmem` CLI and the installed plugin skills.

Use plugin skills (`$nowledge-mem:read-working-memory`, `$nowledge-mem:search-memory`, `$nowledge-mem:save-thread`, `$nowledge-mem:distill-memory`, `$nowledge-mem:status`) when they match the task, or compose direct `nmem` commands whenever that is clearer or more efficient.

## Working Memory

At session start, or when recent priorities would help, read Working Memory:

```bash
nmem --json wm read
```

If it returns `exists: false`, say there is no briefing yet and continue normally.

## Search Memory

Search when:

- the task connects to previous work
- the user asks why a decision was made
- the bug or design resembles a past issue
- durable context would improve the answer

Start with:

```bash
nmem --json m search "query"
```

Use `--mode deep` when the need is conceptual, historical, or the first pass is weak.

When the user asks about a past conversation, search threads too:

```bash
nmem --json t search "query" --limit 5
```

Inspect threads progressively:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

## Distill Memory

Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.

Use `nmem --json m add` for new knowledge. If an existing memory captures the same concept, use `nmem --json m update <id>` instead.

Prefer high-signal memories over routine chatter. Use `--unit-type` (`fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`) and `-l` labels when they improve retrieval.

## Save Thread

Only save the Codex session when the user explicitly asks.

```bash
nmem --json t save --from codex -p . -s "Brief summary of what was accomplished"
```

This saves the real Codex session transcript. The summary adds searchable metadata; the full conversation is preserved.

## Remote Setup

For remote Mem, prefer `~/.nowledge-mem/config.json`:

```json
{
  "apiUrl": "https://mem.example.com",
  "apiKey": "nmem_your_key"
}
```

Use `NMEM_API_URL` and `NMEM_API_KEY` only for temporary shell-level overrides.
