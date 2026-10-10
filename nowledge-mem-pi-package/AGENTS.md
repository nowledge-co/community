# Nowledge Mem for Pi

You have access to the user's cross-tool knowledge through the `nmem` CLI and five installed skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-thread`, and `status`.

## Context at Session Start

Load the user's current context at the beginning of every session. Prefer Context Bundle because it includes owner identity, resolved AI Identity, active scope, active rules, and Working Memory:

```bash
nmem --json context --source-app pi
```

If Context Bundle is not available in this runtime or the installed `nmem` is older, fall back to the lightweight Working Memory briefing:

```bash
nmem --json wm read
```

If this runtime already knows a project or agent lane, add `--space "<space name>"`. Multi-agent orchestrators can set `NMEM_AGENT_ID="<agent-slug>"` before launching Pi. Use `NMEM_HOST_AGENT_ID` only for stable host-local aliases, and `NMEM_SPACE` only when the whole run should override the identity's default space.

If Context Bundle already includes Working Memory, do not immediately read Working Memory again. Don't re-read during the same session unless the user asks or the session context changes materially.

## Proactive Search

Search when the task connects to prior work, the user references a past decision, or context from before would improve the answer. Don't search speculatively for every message.

```bash
nmem --json m search "query"
```

If the runtime already has an ambient lane, add `--space "<space name>"` to context, memory search, thread search, and save commands.

Use `--mode deep` when the first pass returns weak results or the query is conceptual.

## Retrieval Routing

Use memory search for distilled knowledge (decisions, procedures, preferences). Use thread search for past conversations:

```bash
nmem --json t search "query" --limit 5
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Choose a known target offset only for one bounded read; do not walk pages.

If a memory result includes `source_thread`, inspect the original conversation with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.

## Autonomous Save

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Don't wait for the user to ask.

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

## Thread Capture

The Nowledge Mem Pi package includes an extension that automatically syncs completed Pi conversations as Mem threads. It captures the active Pi session branch after completed agent turns and at session boundaries.

When the user explicitly asks for a checkpoint or handoff, create a curated summary with `nmem --json t create`. Be clear that this is a focused handoff in addition to automatic transcript sync. Include goals, decisions, files touched, risks, and next steps.

```bash
nmem --json t create \
  -t "Session Handoff - <topic>" \
  -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." \
  -s generic-agent
```

## Remote Configuration

If Nowledge Mem runs on a different machine, credentials live in `~/.nowledge-mem/config.json` with `apiUrl` and `apiKey` fields. Environment variables `NMEM_API_URL` and `NMEM_API_KEY` override the config file.

### Bounded thread reads

Search memories or threads first, then choose the specific conversation and message range needed. Call `thread_fetch_messages`, a host thread-fetch tool, or `nmem --json t show` at most once per question, using a small message limit (for example 8) and a content limit of 1200 where supported. A known target range may use a nonzero offset once.

Never loop over offsets to reconstruct a conversation. Do not raise `--content-limit` to compensate for a slow or incomplete read. Small output limits do not guarantee cheap server-side work on every deployed backend. If a read is slow, incomplete, fails or times out, stop, report the evidence gap, and refine the search rather than retrying pages. A later explicit user request for another range is a new bounded read; a routine “continue” is not permission to drain the thread.
