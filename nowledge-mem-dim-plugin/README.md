# Nowledge Mem for Dim

This package connects [Dim](https://github.com/arcships/dim) to Nowledge Mem:

- **SessionStart** loads the Context Bundle (or Working Memory) once and adds it,
  with the routing guidance, to the Session's context.
- **UserPromptSubmit** adds the routing guidance to every operator prompt. It is
  a fixed text and makes no Mem call.
- **Stop** captures the Session as a Mem Thread after every completed turn, from
  the conversation Dim itself keeps.
- The Mem MCP server is registered for the Session, and five skills teach the
  agent to read, search, save, explore, and diagnose memory.

All four parts fail open. If Mem is unreachable, the CLI is missing, or a hook
times out, the turn still completes and Dim continues.

## Requirements

- Dim `v0.1.0-alpha.20` or newer, either the released `dima` build or Dim built
  from source. The package uses plugin hooks, plugin skills, plugin MCP servers,
  and Dim's Session export; all four exist in that release.
- `nmem` (Nowledge Mem CLI) on `PATH`, or `NMEM_CLI_PATH` pointing at it. The
  desktop app's **Install CLI** installs it.

Dim's manifest has no version field, so this package's version lives in
`CHANGELOG.md` and in the community registry (`integrations.json`).

## Install

Dim installs a plugin from a local directory; a plugin inside a repository
subdirectory is not installable from its Git URL. Clone the community
repository and install the package directory:

```bash
git clone https://github.com/nowledge-co/community
dima plugin install ./community/nowledge-mem-dim-plugin
```

`dimcode plugin install` works the same way when Dim was built from source.
Then start a new Dim Session.

Update:

```bash
git -C community pull
dima plugin reload nowledge-mem
```

A local-path plugin is not updatable in place, so reinstall it if `reload`
reports it is gone. `dima plugin list` shows the installed plugin and `dima
plugin disable nowledge-mem` turns it off without uninstalling it.

## What the Session sees

**Startup.** A `SessionStart` hook runs when a Session starts. It resolves the
ambient identity and Space, reads the Context Bundle with
`nmem --json context --source-app dim`, and falls back to `nmem --json wm read`.
The budget is 10 seconds, and the injected text is capped below Dim's 16 KiB
context limit. If nothing loads, the hook emits nothing.

Dim runs `SessionStart` once, when the Session starts. A resumed Session runs no
hook, and a compacted Session replays the block it captured at the start, so the
briefing can be stale after either. The routing text says so and points at
`nmem wm read` as the current view.

**Every prompt.** `UserPromptSubmit` adds one short paragraph: search once before
concluding when the task depends on prior context, keep the identity and Space,
and report retrieval failures honestly. Dim appends it as a separate text block
of the operator message, and this package strips the block when it later reads
the conversation, so Mem never re-ingests its own guidance.

**Every completed turn.** `Stop` runs asynchronously and imports what is new in
the Thread. The first Stop creates the Thread; later Stops append only the new
messages with a checkpoint (`--expected-message-count`). A checkpoint conflict,
or a changed prefix in what was already imported, causes one full re-import.
Concurrent Stops for the same Session coordinate through a lock and a pending
marker, so two imports never run at once and the last turn is never dropped.
Capture reads the Session only up to the last `turn/end`, so a turn that is
still running is left for a later Stop.

## How capture reads the Session

Dim has no transcript file. The hook reads the conversation through Dim's own
daemon with:

```bash
"$DIMCODE_HOME/rust/dimcode-server" --home "$DIMCODE_HOME" session export <session-id> --format json
```

That command returns the main branch, product-visible events, and costs time in
the size of the conversation, not of the whole store.

**The hook runs exactly one executable, and never one found on `PATH`:**

1. `NMEM_DIM_BIN`, an explicit override for a Dim installed somewhere unusual.
   **Set it only to the build that is running the daemon.** A Dim CLI whose
   version differs from the running daemon shuts that daemon down and starts its
   own when it connects, which would replace the user's Session's daemon.
2. `"$DIMCODE_HOME/rust/dimcode-server"` (`dimcode-server.exe` on Windows). Dim's
   own CLI creates and maintains this file as a link to the executable that
   started the daemon, so its version always matches the daemon's.
3. Otherwise the hook skips capture and writes one diagnostic line.

The package never searches `PATH` for a Dim command, and it never writes into
`DIMCODE_HOME`.

## What is captured

Only the conversation, and only up to the last completed turn end:

- operator input text, as typed;
- assistant reply text from turns whose exported outcome is `completed`, and
  from model requests that completed (a step that called a tool is not a
  completed reply; a request that failed mid-output is not one either);
- for a Collaboration member Session, the unwrapped `<dim-agent-message>` task as
  its operator turn, under that member's own Session id.

Excluded: every content block Dim injects for a runtime or a hook (SessionStart
context, follow-up, scheduled and goal inputs, hook output, collaboration
reports), reasoning, every tool step and tool result, and every text block this
package's own prompt hook added. A member Session is its own Thread; the leader's
Thread does not contain the member's work.

Thread ids are stable: `dim-<session-id>` with `--source dim`. The Thread title
is the first line of the first operator message.

## State and diagnostics

Capture state and logs live under the system temporary directory, in
`nowledge-mem/dim-capture-<uid>` on macOS and Linux (per-user `%TEMP%` keeps
`nowledge-mem/dim-capture` on Windows), keyed by a digest of `DIMCODE_HOME` and
the Session id. On POSIX the package creates that directory mode 0700 and then
verifies it is a real directory owned by the current user with no group or
other access; if the check fails, capture writes nothing, not even the
diagnostic log. State supports `O_NOFOLLOW` where the platform provides it, so
a planted symlink is never followed. State holds the local position (how many
Session messages Mem has acknowledged), Mem's reported Thread count, and a
digest of the acknowledged messages — never conversation text. The position
bounds each delta and the digest check; Mem's count is the expected total for
the next checkpoint, and the two differ after a full re-import into a Thread
that kept earlier versions of changed messages. The import file is written
mode 0600 under the same root and removed after use. The diagnostic log
(`nowledge-mem-dim-hook.log`) is mode 0600, bounded at 64 KiB, and records only
hook names, statuses, and durations; it never contains prompts, replies, keys,
or tokens.

## MCP

`mcp.json` registers a streamable HTTP server for the local Mem:

```json
{
  "mcpServers": {
    "nowledge-mem": {
      "type": "http",
      "url": "${NMEM_MCP_URL:-http://127.0.0.1:14242/mcp}",
      "headers": { "APP": "Dim" }
    }
  }
}
```

Dim names the tools it exposes to the model with a generated suffix, so the
skills refer to them by description instead of by exact name. The CLI (`nmem`)
is the exact fallback for every skill.

For a Mem on another URL, set `NMEM_MCP_URL` in the daemon's environment before
Dim starts. A remote Mem that requires an API key is configured with the user's
own MCP entry instead, because Dim does not let a user edit a plugin's MCP
entries; `nmem config mcp show` prints the method and headers for the current
client configuration. This package deliberately sends no credential header.

## Skills

- **read-working-memory** — read the briefing when none was injected or the
  injected one is stale.
- **search-memory** — search memories and Threads before concluding; bounded
  Thread reads.
- **distill-memory** — save durable knowledge proactively; add versus update.
- **explore-graph** — show or expand the memory graph for retrieved IDs.
- **status** — diagnose the connection, CLI, MCP, and hooks.

## Limits

- Dim has no session-end, pre-compaction, or subagent lifecycle event, so capture
  happens at each completed Stop and the startup briefing is replayed rather
  than refreshed after resume or compaction.
- A failed or cancelled turn fires no Stop, so its operator input is captured at
  the next completed turn and its partial reply is not captured.
- With Dim's execution sandbox on and network off, `nmem` commands the model
  runs cannot reach Mem, while the MCP tools and the hooks still work.
- MCP tools are named by Dim, not by Mem; use their descriptions.
- A repository subdirectory cannot be installed from a Git URL, so installation
  starts from a community checkout.

## Platforms

Hooks run on macOS, Linux, and Windows. Dim runs the Windows hook command
through its execution shell, which is PowerShell in a default install; the
package ships a command line that runs under both PowerShell and cmd. The
command resolves `powershell.exe` through `PATH` under PowerShell (pwsh and
Windows PowerShell) and under Git Bash; under a cmd execution shell, cmd
searches the Session's working directory before `PATH`, so a `powershell.exe`
placed there would win. `run-hook.ps1` starts Python from absolute `PATH`
directories only, using Windows PowerShell 5.1. If no trusted Python exists,
the hooks exit 0 and Dim continues.
