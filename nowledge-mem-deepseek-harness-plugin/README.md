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

The adapter supports DSH 0.1.5-rc.2, 0.1.7-rc.1, 0.2.1-alpha.1, and 0.2.1-rc.2. It uses
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

### Sandbox Compatibility Retry

The plugin does not retry a sandbox-unavailable `nmem` command with
`danger-full-access` by default. An operator who explicitly accepts that wider
access may set `allowDangerFullAccessRetry: true` in the `nowledge-mem` plugin
config. Even with that opt-in, the retry runs only when the DSH host provides
`ctx.sandboxPolicy` and resolves the requested policy; otherwise it fails
closed and logs why the retry was skipped.

## Known Limitations

- DeepSeek Harness is in developer preview, so public package APIs may change.
- Historical DSH sessions are not backfilled by this package yet; it captures new sessions while the plugin is active.
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

GitHub Actions runs ESLint and tests on every pull request and push to `main`.
The test matrix covers Ubuntu and Windows with Node.js 24 and DSH 0.1.7-rc.1,
0.2.1-alpha.1, and 0.2.1-rc.2. It also checks the npm package contents with `npm pack --dry-run`.
