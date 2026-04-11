# Nowledge Mem for Codex CLI

You have access to the user's Nowledge Mem through the `nmem` CLI.

Use the installed prompts when convenient, but compose direct `nmem` commands whenever that is clearer or more efficient.

## Working Memory

At session start, or when recent priorities would help, read Working Memory:

```bash
nmem --json wm read
```

If it returns `exists: false`, say there is no briefing yet and continue normally.

If this runtime already knows a project or agent lane, add `--space "<space name>"`.

Only fall back to `~/ai-now/memory.md` for older local-only **Default-space** setups.

If the task is a continuation, review, regression, release, integration, or prior-decision question, follow the briefing with one targeted search instead of stopping there.

## Search Memory

Search proactively when past context would improve your response. Do not wait to be asked. Key signals:

- the user references prior work, decisions, preferences, or plans
- the task connects to a named feature, bug, refactor, or subsystem
- a debugging pattern resembles something solved earlier
- the user asks for rationale, procedures, or recurring workflow details
- the user uses implicit recall language: "that approach", "like before", "the pattern we used"

Start with:

```bash
nmem --json m search "query"
```

If the runtime already has an ambient lane, add `--space "<space name>"` to Working Memory, memory search, thread search, and save commands.

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

Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.

Use `nmem --json m add` for new knowledge. If an existing memory captures the same concept and new information refines it, use `nmem m update <id>` instead of creating a duplicate.

Prefer high-signal memories over routine chatter. Use `--unit-type` (learning, decision, fact, procedure, event, preference, plan, context) and `-l` labels when they improve retrieval.

## Save Session

Only save the Codex session when the user explicitly asks.

Use:

```bash
nmem --json t save --from codex -p . -s "Brief summary of what was accomplished"
```

This saves the real Codex session messages. The summary is only metadata.

## Remote Setup

For remote Mem, configure the local client once:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
```

Use `NMEM_API_URL` and `NMEM_API_KEY` only for temporary shell-level overrides.
