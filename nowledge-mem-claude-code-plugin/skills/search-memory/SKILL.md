---
name: search-memory
description: Search Nowledge memories and threads for continuation, reviews, regressions, releases, connector work, prior decisions, cross-tool context, or exact history. Search proactively before concluding, even when startup Working Memory is already present.
---

# Search Memory

## When to Search

Run one targeted search before concluding continuation, review, regression,
release, connector, prior-decision, cross-tool, or exact-history work. References
to a previous fix, "that approach", or "like before" are strong signals.
The startup Context Bundle / Working Memory is a briefing, not a substitute
for this search. Do not wait for the user to explicitly request retrieval.

Skip trivial, independent tasks, generic syntax questions, and an explicit
fresh start.

## Retrieve Progressively

Before searching, briefly tell the user what prior context you are looking for.
Use the CLI; this plugin does not register an MCP server. If NMEM_CLI_PATH is
set, use its quoted value as the executable instead of bare nmem.

Start with the smallest relevant surface:

```bash
# Durable decisions, procedures, and learnings
nmem --json m search "3-7 core concepts" -n 5

# Prior conversations and exact discussion history
nmem --json t search "query" --limit 5
```

Keep the active Space from the Context Bundle. NMEM_SPACE selects an explicit
session-wide lane; legacy NMEM_SPACE_ID is compatibility-only. If an AI Identity
resolved another lane and no session override is set, pass that existing lane
with --space "<space name>". Never infer a Space from cwd, git, or a project name,
and never remove a selected lane because it returned no matches.

If normal memory search is weak or conceptual, try Deep Search once:

```bash
nmem --json m search "query" --mode deep -n 5
```

Inspect only relevant hits. Judge their content and server warnings rather than
applying one fixed score threshold across search modes. When a memory includes
source_thread, or thread search finds the likely conversation, read it in pages:

```bash
nmem --json m get <memory_id>
nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200
```

Increase the offset only when more messages are needed. Use label, importance,
or time filters only when they narrow this question. For code-backed knowledge,
verify the finding against the current repository before treating it as current.

## Respond Honestly

Use retrieved knowledge naturally and cite the memory or original thread when
it supports the answer. Distinguish a successful search with no relevant matches
from a CLI, authentication, timeout, or server failure. If retrieval is unavailable,
say so briefly and continue the authorized work.

A session-start receipt confirms briefing loading. A Bash search or Skill call
shows actual retrieval in the host transcript; do not claim a search occurred
because startup context was loaded.

## Troubleshooting

Run /nowledge-mem:status or nmem status to check the connection. If the CLI is
outside PATH, set NMEM_CLI_PATH to its executable path. Install nmem-cli with pip
or pipx if needed; Arch Linux users can use yay -S nmem-cli or paru -S nmem-cli.
For remote Mem, configure the shared client on this machine with
nmem config client set url and nmem config client set api-key.
