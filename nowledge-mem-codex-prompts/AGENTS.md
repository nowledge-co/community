# Nowledge Mem for Codex CLI

You have access to the user's Nowledge Mem through the `nmem` CLI.

Use the installed prompts when convenient, but compose direct `nmem` commands whenever that is clearer or more efficient.

## Working Memory

At session start, or when recent priorities would help, read Working Memory:

```bash
nmem --json wm read
```

If it returns `exists: false`, say there is no briefing yet and continue normally.

Only fall back to `~/ai-now/memory.md` for older local-only setups.

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

When the user is asking about a past conversation or previous session, search threads directly too:

```bash
nmem --json t search "query" --limit 5
```

If a memory result includes `source_thread`, or thread search finds the likely conversation, inspect it progressively instead of loading everything at once:

```bash
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

## Distill Memory

When the conversation produces a durable insight, decision, lesson, or procedure, save an atomic memory with `nmem --json m add`.

Prefer high-signal memories over routine chatter.

## Save Session

Only save the Codex session when the user explicitly asks.

Use:

```bash
nmem --json t save --from codex -p . -s "Brief summary of what was accomplished"
```

This saves the real Codex session messages. The summary is only metadata.

## Remote Setup

For remote Mem, prefer `~/.nowledge-mem/config.json`. Use `NMEM_API_URL` and `NMEM_API_KEY` only for temporary shell-level overrides.
