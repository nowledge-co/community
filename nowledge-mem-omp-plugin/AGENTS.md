# Nowledge Mem for OMP

You have access to the user's cross-tool knowledge through the `nmem` CLI and five installed skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-thread`, and `status`.

## Context at Session Start

The OMP plugin injects Context Bundle or Working Memory into the system prompt at startup. Do not immediately read it again unless the user asks or the session context changes materially.

If you need to reload context manually, prefer Context Bundle:

```bash
nmem --json context --source-app omp
```

If Context Bundle is not available in this runtime or the installed `nmem` is older, fall back to Working Memory:

```bash
nmem --json wm read
```

If this runtime already knows a project or agent lane, add `--space "<space name>"`. Multi-agent orchestrators can set `NMEM_AGENT_ID="<agent-slug>"` before launching OMP. Use `NMEM_HOST_AGENT_ID` only for stable host-local aliases, and `NMEM_SPACE` only when the whole run should override the identity's default space.

## Proactive Search

Search when the task connects to prior work, the user references a past decision, or context from before would improve the answer. Don't search speculatively for every message.

```bash
nmem --json m search "query"
```

Use memory search for distilled knowledge and thread search for prior conversations:

```bash
nmem --json t search "query" --limit 5
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Load threads progressively. Increase `--offset` only when the user needs more.

## Autonomous Save

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Search before saving to avoid duplicates.

```bash
nmem --json m add "content" -t "Title" --unit-type decision -i 0.8
```

## Thread Capture

The OMP plugin automatically syncs completed OMP conversation branches as Mem threads with `source_app=omp`. It captures after completed agent turns, before compaction, before session switches, and at shutdown.

When the user explicitly asks for a checkpoint or handoff, create a curated summary with `nmem --json t create`. Be clear that this is a focused handoff in addition to automatic transcript sync.

```bash
nmem --json t create \
  -t "Session Handoff - <topic>" \
  -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." \
  -s generic-agent
```

## Remote Configuration

If Nowledge Mem runs on a different machine, configure the shared client:

```bash
nmem config client set url <mem-url>
nmem config client set api-key <key>
```

Environment variables `NMEM_API_URL` and `NMEM_API_KEY` override the config file.
