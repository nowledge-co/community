---
name: read-working-memory
description: Read Nowledge Mem Context Bundle or Working Memory at the beginning of a ZCode session, when resuming work, or when the user asks about current priorities and context.
---

# Read Working Memory

Start with the context that matters. When the Nowledge Mem MCP server is available, prefer `read_context_bundle` when identity, active space, rules, and Working Memory all matter. Use `read_working_memory` for a lightweight briefing.

## When to use

- Beginning a new conversation or returning to a project
- Resuming a review, regression, release, or earlier decision
- The user asks what they are working on or what the current context is

## How to use

1. Read the Context Bundle once when the task needs owner identity, AI Identity, active scope, active rules, or Working Memory.
2. Otherwise read Working Memory once near session start.
3. If Context Bundle already includes Working Memory, do not call it again unless the user asks or the session changes materially.
4. Use only relevant parts in the response; do not overwhelm the user.
5. For continuation work, follow the briefing with `search-memory` instead of stopping at the briefing.

The MCP tool names are provided by ZCode's Nowledge Mem server. Do not invent host-specific tool names or claim that this Skill itself injects context automatically.

## CLI fallback

If MCP is unavailable and the `nmem` CLI is configured, use the active ambient space when one is known:

```bash
nmem --json context --source-app zcode --space "<space name>"
```

For a lightweight briefing:

```bash
nmem --json wm read --space "<space name>"
```

If no real ambient space is configured, omit `--space` and use the default lane.

If the result says `exists: false`, explain that no Working Memory briefing exists yet and continue normally. If the command fails, report the connection issue without polluting the user's task.

## Spaces

If ZCode or the user provides a real ambient space, pass it through explicitly. Otherwise stay on the Default space; do not invent a new space because a prompt mentions a new topic.
