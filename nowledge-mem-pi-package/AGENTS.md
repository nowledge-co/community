# Nowledge Mem for Pi

You have access to the user's cross-tool knowledge through the `nmem` CLI and five installed skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-thread`, and `status`.

## Working Memory at Session Start

Load the user's current context at the beginning of every session:

```bash
nmem --json wm read
```

If it returns `exists: false`, mention there's no briefing yet and continue. Don't re-read during the same session unless the user asks.

## Proactive Search

Search when the task connects to prior work, the user references a past decision, or context from before would improve the answer. Don't search speculatively for every message.

```bash
nmem --json m search "query"
```

Use `--mode deep` when the first pass returns weak results or the query is conceptual.

## Retrieval Routing

Use memory search for distilled knowledge (decisions, procedures, preferences). Use thread search for past conversations:

```bash
nmem --json t search "query" --limit 5
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Load threads progressively. Increase `--offset` only when the user needs more.

If a memory result includes `source_thread`, inspect the original conversation with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.

## Autonomous Save

Save proactively when the conversation produces a decision, procedure, learning, or important context. Don't wait for the user to ask.

```bash
nmem --json m add "content" -t "Title" --unit-type decision -i 0.8
```

Unit types: `fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`.

Use `-l` to attach labels for easier retrieval: `nmem --json m add "content" -t "Title" --unit-type decision -i 0.8 -l backend -l auth`.

## Add vs Update

Search before saving to avoid duplicates. If a memory already captures the same concept and the new information refines it, update it:

```bash
nmem --json m update <memory_id> -c "updated content"
```

One strong memory is better than three weak ones.

## Thread Save Honesty

Pi does not have a native transcript importer. When the user asks to save the session, create a structured handoff summary using `nmem --json t create`. Be transparent: this is a curated summary, not a verbatim transcript. Include goals, decisions, files touched, risks, and next steps.

```bash
nmem --json t create \
  -t "Session Handoff - <topic>" \
  -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." \
  -s generic-agent
```

## Remote Configuration

If Nowledge Mem runs on a different machine, credentials live in `~/.nowledge-mem/config.json` with `apiUrl` and `apiKey` fields. Environment variables `NMEM_API_URL` and `NMEM_API_KEY` override the config file.
