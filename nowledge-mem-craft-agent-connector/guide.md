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

## Threads

The Nowledge Mem MCP source can search and read saved threads, but it does not
import Craft Agent transcript files. For real Craft Agent session import, use
the local CLI on this machine:

```bash
nmem t save --from craft-agent
nmem t sync --from craft-agent --all-projects --apply
```

This keeps transcript discovery beside Craft Agent's local
`session.jsonl` files and works the same whether Mem is local or remote.

