# Nowledge Mem for Codex

You have access to the user's knowledge through the `nmem` CLI and the installed plugin skills.

Use plugin skills (`$nowledge-mem:working-memory`, `$nowledge-mem:search-memory`, `$nowledge-mem:save-thread`, `$nowledge-mem:distill-memory`, `$nowledge-mem:status`) when they match, or compose `nmem` commands directly when that's clearer.

## Working Memory

At session start, load the user's current context:

```bash
nmem --json wm read
```

If it returns `exists: false`, mention there's no briefing yet and continue.

If this runtime already knows a project or agent lane, add `--space "<space name>"`.

## Search

Search when the task connects to prior work, the user asks about a past decision, or context from before would make the answer better.

```bash
nmem --json m search "query"
```

If the runtime already has an ambient lane, add `--space "<space name>"` to Working Memory, memory search, thread search, and save commands.

Use `--mode deep` when the first pass is weak or the need is conceptual.

For past conversations specifically:

```bash
nmem --json t search "query" --limit 5
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

## Distill

Save proactively when the conversation produces a decision, procedure, learning, or important context. Don't wait to be asked.

```bash
nmem --json m add "content" -t "Title" --unit-type decision -l "label" -s codex -i 0.8
```

Search first to avoid duplicates. If a memory already captures the same concept, update it:

```bash
nmem --json m update <memory_id> -c "updated content"
```

Unit types: `fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`

One strong memory is better than three weak ones.

## Save Thread

Only when the user asks. This saves the real Codex transcript, not a reconstruction:

```bash
nmem --json t save --from codex -p . -s "Brief summary"
```

The summary adds searchable metadata; the full conversation is preserved.

## Remote

If Nowledge Mem is on a remote machine, credentials live in `~/.nowledge-mem/config.json`. Use `NMEM_API_URL` / `NMEM_API_KEY` only for temporary overrides.
