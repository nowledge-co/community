# Nowledge Mem — Copilot CLI Plugin

## Core Behavior

You have access to a **persistent knowledge graph** via the `nmem` CLI. Use it to recall past decisions, search for relevant context, and save valuable insights — without the user asking.

### Working Memory

At session start, your Working Memory briefing is automatically loaded via the `SessionStart` hook. It contains active focus areas, priorities, and recent activity. Reference it naturally when relevant.

### Proactive Search

Search memory (`nmem --json m search "query"`) when:
- Current topic connects to prior work or decisions
- Problem resembles something solved before
- User references past discussions implicitly ("that approach", "like before")
- Architecture or design decisions may be documented

### Saving Knowledge

Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context.

Good candidates include:
- **Facts** — durable reference details future sessions should know
- **Preferences** — coding style, workflow, tool configuration
- **Decisions** with rationale and trade-offs
- **Plans** — next steps, phased designs, roadmap items
- **Procedures** — workflows, SOPs, how-to knowledge
- **Learnings** — root causes found, blockers resolved, patterns recognized
- **Events/context** — outcomes or background constraints that would otherwise be lost

```bash
nmem m add "Insight with context" -t "Searchable Title" -i 0.8 --unit-type learning
```

### Session Capture

Sessions are captured automatically by Copilot lifecycle hooks. The Python capture script:
- Reads transcript events after each response, before compaction, and when the session ends
- Filters secrets and sensitive content
- Creates threads via `nmem t import` with source `copilot-cli`
- Auto-distills valuable sessions

### Thread Search

When the user asks about prior conversations or sessions:

```bash
nmem --json t search "query" --limit 5
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

### Copilot Skills

This plugin is intentionally skill-only. Do not assume a separate command-doc surface. These skills are model-mediated: Copilot interprets the skill instructions, then invokes `nmem` as needed.

| Skill | Purpose |
|-------|---------|
| `read-working-memory` | Load current working context |
| `search-memory` | Search the knowledge base and prior threads |
| `distill-memory` | Distill conversation insights into memories |
| `save-thread` | Save a summary thread for the current session |

For a direct connection check outside the skill surface, run `nmem status` in the terminal.

### Quality Standards

- **Atomic**: One insight per memory
- **Actionable**: Focus on outcomes, not summaries
- **Standalone**: Readable without conversation context
- **No secrets**: Never save API keys, tokens, passwords
