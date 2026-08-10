# Nowledge Mem

Use Nowledge Mem when prior decisions, preferences, project history, or durable
context can improve the answer.

## When To Read

- At the start of continuation work, read Working Memory or Context Bundle.
- Before architecture, release, integration, or debugging decisions, search for
  relevant prior work.
- When the user asks what they were working on, start with Working Memory.

## When To Save

Save proactively when the conversation produces a durable fact, preference,
decision, plan, procedure, learning, event, or important context. Do not wait to
be asked.

Good saves are concrete:

- "We chose X because Y; revisit if Z changes."
- "For this project, run A before B."
- "The user prefers C for this kind of work."

Avoid saving temporary narration, command output, or guesses that are not yet
settled.

## Cindy Threads

The Nowledge Mem MCP server can search and read saved threads, but it does not
import Cindy's own desktop database or the transcript files of harnesses Cindy
launches.

For exact capture, use the dedicated connector for the runtime that produced the
conversation:

```bash
nmem t save --from codex
nmem t save --from claude-code
nmem t sync --from pi --apply
```

Keep the transcript source as `codex`, `claude-code`, `pi`, or the actual child
runtime. Use a Mem AI Identity such as `NMEM_AGENT_ID=cindy` only when Cindy is a
durable role/persona; it is not a replacement for `source_app`.
