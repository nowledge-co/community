# Nowledge Mem for DeepSeek Harness

[![Get Nowledge Mem](https://img.shields.io/badge/Get-Nowledge%20Mem-00A3A3?style=flat&logo=rocket&logoColor=white)](https://mem.nowledge.co/)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-dsh--plugin-111827?style=flat)](https://github.com/deepseek-ai/deepseek-harness)

One memory layer for every AI tool and agent, packaged as a DeepSeek Harness (`dsh`) bundle. Nowledge Mem brings DSH into the same durable memory system as your other agents, with startup context, prompt-time recall, MCP memory tools, and turn-end thread capture.

This repository is the canonical standalone plugin package, mirrored in `nowledge-co/community` for the Nowledge Mem connector index.

## Install

```sh
dsh plugin --profile web add github:nowledge-co/nowledge-mem-deepseek-harness
dsh web
```

For a local checkout of `nowledge-co/community`, run this from the repository root:

```sh
dsh plugin --profile web add ./nowledge-mem-deepseek-harness-plugin
dsh web
```

Make sure the `nmem` CLI is on `PATH`, then verify:

```sh
nmem status
nmem config mcp show --host deepseek-harness
```

The adapter supports DSH 0.1.5-rc.2, 0.1.7-rc.1, 0.2.1-alpha.1,
0.2.1-rc.2, 0.2.1-rc.3, 0.2.1-rc.5, 0.2.2-rc.1 and 0.2.2-rc.2. It uses
`shell.execute(...).result()` on current hosts and retains the legacy
`shell.run()` fallback. Injected messages use `source.kind: "plugin:nowledge-mem"`,
matching DSH's v3-to-v4 migration; existing legacy snapshots are still recognized.
Restart DSH after replacing an installed plugin version.

The bundle connects to the local Mem MCP endpoint by default:

```text
http://127.0.0.1:14242/mcp
```

For Nowledge Cloud or another remote Mem, set:

```sh
export NMEM_MCP_URL="https://<workspace>/mcp"
export NMEM_API_KEY="<mem-api-key>"
```

DSH intentionally removes credential-shaped ambient variables from child
processes. The plugin explicitly forwards `NMEM_API_KEY` only to its nmem calls,
including a deliberately empty value; other provider secrets are not forwarded.
Historical confirmation keeps its previewed connection key even if ambient
configuration changes before apply. Keys never become CLI argument text.

## What It Does

- Injects the Nowledge Mem Context Bundle once per DSH session through `agent/pre-step`.
- Runs prompt-time memory recall for continuation, release, regression, connector, plugin, and other recall-shaped prompts.
- Adds the Mem MCP server through DSH's reconnecting `@deepseek-ai/dsh-mcp-client`, so tools appear as `mcp__nowledge_mem__...`.
- Imports the real DSH surface transcript after completed turns with `nmem t import --source deepseek-harness`.
- Stamps CLI imports with `NMEM_IMPORT_ORIGIN=deepseek-harness`.

## Configuration

The bundle accepts these row config fields in a later `cordis.patch.yml` override:

```yaml
- id: nowledge-mem
  config:
    cliPath: nmem
    sourceApp: deepseek-harness
    importOrigin: deepseek-harness
    contextOnSessionStart: true
    recallOnPrompt: true
    syncOnTurnEnd: true
    allowDangerFullAccessRetry: false
    recallLimit: 8
    spaceId: my-space-id
    agentId: deepseek-harness
```

Ambient variables also work:

- `NMEM_SPACE`
- `NMEM_AGENT_ID`
- `NMEM_HOST_AGENT_ID`
- `NMEM_MCP_URL` or `NOWLEDGE_MEM_MCP_URL`
- `NMEM_API_KEY`

## Model Experience

### Startup Context

The model sees one plugin-sourced user message containing the current Nowledge Mem Context Bundle. It is marked as `form: "snapshot"` and reminds the model that it is cross-tool context, not an instruction override.

### Prompt-Time Recall

When the user asks to continue, remember, review previous work, ship a release, debug a regression, or discuss connectors/plugins, the plugin calls:

```sh
nmem --json m search "<prompt>" -n 8
```

The prompt is the text the user typed into that step: messages with
`source.kind: "user"`, text blocks only. It decides whether recall runs and is
the search query. Other user-role context entering the step (runtime context,
background job notices, subagent reports, goal rounds, other plugins), tool
results, reasoning and tool calls neither trigger recall nor join the query, so
later steps of a tool-using turn do not search on tool output. English trigger
keywords match whole words and their plural or verb forms (`mem` does not match
"meme" or "member"); Chinese keywords match anywhere in the text.

The model sees a bounded recall message with memory titles, source hints, scores, and content.

### MCP Tools

Mem MCP tools are registered through DSH's MCP bridge under the `nowledge_mem` namespace. DSH currently bridges MCP tools only; MCP resources and prompts are not surfaced by the Harness client.

### Thread Capture

After each completed DSH turn, the plugin imports human input and assistant
reply text into Mem as `source=deepseek-harness`. DSH marks actual user input
with `source.kind: "user"`; user-role context from other producers (runtime,
clock, skills, Mem or other plugins) is not a human prompt. Assistant steps
containing tool calls, including their intermediate narration, tool results,
reasoning blocks and execution metadata are not conversation text and are not
stored as Thread messages. Image blocks retain an attachment placeholder, not
image bytes. Visible text is preserved verbatim within the configured size cap;
the plugin does not summarize or rewrite answers.

Updating the plugin changes future captures; it does not delete or rewrite
previously imported noisy messages. Stable identities still prevent new copies
of unchanged conversation messages. Reopening an older polluted session may
report an import conflict if an existing message with the same identity contains
execution text: do not delete the Thread or change its identity to force a
retry. Review a scoped cleanup/export with support first. New sessions can be
used to verify the updated capture without touching old data.

### Explicit Historical Backfill

On a host with `commands` and `sessionQuery` (qualified on DSH 0.2.2-rc.2),
the bundle adds a **human slash command**, not an agent tool:

```text
/mem-backfill list
/mem-backfill preview <exact-space-id> <session-id> [another-session-id]
/mem-backfill apply <token-from-preview>
/mem-backfill cancel
```

Use `nmem --json spaces list` to find the intended Space ID in your configured
destination. Listing is metadata-only, at most 50 IDs per page; use
`/mem-backfill list 50` for the next page. Select 1–10 sessions explicitly.
Only persisted, top-level sessions whose workspace directory matches the current
session are eligible; live-only, private-marked, subagent and other-workspace
sessions are refused. The host query service supplies this profile's logical,
replay-validated history; the plugin never walks profile directories. If an ID
or Space contains whitespace, use percent encoding (listing already returns
copyable encoded session IDs).

Preview shows the exact destination address, Space, selected IDs, titles and
clean message counts, validates the exact Space ID against the authenticated
roster, and writes no transcript. It uses the effective nmem CLI
connection, including persisted client settings; App, Access Anywhere and Cloud
all use that same CLI path. Check the address and Space before confirming.
The one-use token belongs to this human command session, expires in ten minutes,
and freezes the selected conversation snapshot and connection privately in
memory. It is never a durable credential or an authorization bypass. Applying
does not include activity added after preview, change the automatic capture's
Space, or clean old noisy Threads. The normal Mem key and Space authorization
still applies to every write. Restarting/unloading the plugin discards previews.

Each selected session is limited to 100,000 observed events and 2 MiB of clean
snapshot data. Only human input and assistant replies survive; tools, reasoning,
injected context and stream payloads do not. Apply reports each session's
acknowledgement or failure; native identities make a repeated preview/apply
converge rather than create a second Thread. A changed/older polluted Thread may
still conflict and is left for deliberate inspection. An interrupted command
can have committed earlier sessions (or the last timed-out import); preview
again to reconcile safely. Cancellation prevents starting remaining sessions,
but cannot undo a server transaction already committed. Hosts lacking either
optional service keep normal capture/recall; no filesystem fallback runs.

### Sandbox Compatibility Retry

Import payloads are private temporary files under
`$DSH_HOME/nowledge-mem/staging` (default `~/.dsh/nowledge-mem/staging`).
Each attempt removes its payload in a `finally` block. Linux workspace-write
sandboxes mount an empty `/tmp`; keep DSH_HOME outside `/tmp`, including symlink
targets. A temporary DSH_HOME there is refused with a diagnostic rather than
silently widening the sandbox. `nmem t import --stdin` accepts Markdown, not the
structured JSON used for stable message IDs, so it is not an equivalent transport.

Failed captures retain their last acknowledged checkpoint and retry on a later
turn after exponential backoff (1 second, capped at 60 seconds). No background
upload timer runs. Graceful plugin teardown drains already queued captures,
including a completed headless turn; host forced-exit deadlines still apply.
A checkpointed append may retry once with a full transcript;
an initial full import is already reconciliation and is not immediately repeated.
Persistent conflicts need inspection of the existing Thread, not deletion or a
new identity. Warnings distinguish timeout, process failure, invalid JSON and
semantic rejection without printing payloads or raw shell error messages.
Startup-context failures use the same backoff range independently of capture.
Invalid custom recall patterns fall back to the standard pattern with a warning.

Normal DSH session IDs keep their old Thread IDs. Previously lossy IDs (spaces,
slashes or other punctuation) now use `deepseek-harness-~<sha256>`; any old Thread
created from a sanitized ID is left untouched for explicit review, never migrated
or deleted automatically.

The plugin does not retry a sandbox-unavailable `nmem` command with
`danger-full-access` by default. An operator who explicitly accepts that wider
access may set `allowDangerFullAccessRetry: true` in the `nowledge-mem` plugin
config. Even with that opt-in, the retry runs only when the DSH host provides
`ctx.sandboxPolicy` and resolves the requested policy; otherwise it fails
closed and logs why the retry was skipped.

## Known Limitations

- DeepSeek Harness is in developer preview, so public package APIs may change.
- Historical capture requires the explicit preview/apply command above and the optional host services; no automatic bulk upload or old-data cleanup runs.
- The DSH MCP bridge exposes tools only, so Nowledge Mem resources/prompts are not shown through MCP today.
- Turn capture depends on the local `nmem` CLI being available in the DSH process environment.

## Community Position

The canonical public repository is `nowledge-co/nowledge-mem-deepseek-harness`, tagged with `dsh-plugin` for DeepSeek Harness ecosystem discovery. The `community` repository keeps a registry/index mirror for Nowledge Mem surfaces.

## Development

Install development dependencies before running the regression suite:

```sh
npm ci
npm run lint
npm test
```

The plugin tests exercise the entry point with DSH 0.2.1-alpha.1's real message
and Session implementations and validate context and recall in both durable
user-message and inbox-splice rows using the official v4 admission validator.
CLI responses and shell execution are deterministic test doubles; a live DSH
and Mem smoke test is still required to verify an installed release.

The dedicated installed-host CI lane additionally packs the plugin, installs it
into an isolated DSH 0.2.2-rc.2 headless profile, runs a real bash tool turn
against the official loopback mock model, and checks that clean transcript
capture completes before host exit. That lane uses a fixture CLI receipt rather
than a production Mem destination; separate App/Cloud qualification uses actual
nmem and disposable backend stores. Neither test reads your regular DSH profile.

GitHub Actions runs ESLint and tests on every pull request and push to `main`.
The test matrix covers Ubuntu and Windows with Node.js 24 and DSH 0.1.7-rc.1,
0.2.1-alpha.1, 0.2.1-rc.2, 0.2.1-rc.3, 0.2.1-rc.5, 0.2.2-rc.1 and 0.2.2-rc.2.
It also checks the package contents with `npm pack --dry-run`; installation is
from Git, not an independently published npm release.

Thanks to BBleae (晴猫) for the PowerShell and human-only recall fixes (#19, #26,
#27), and vizmoe for qualifying newer host previews (#24).
