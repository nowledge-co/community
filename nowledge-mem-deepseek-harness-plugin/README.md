# Nowledge Mem for DeepSeek Harness

Community DeepSeek Harness (`dsh`) bundle for Nowledge Mem, published from the standalone `nowledge-co/nowledge-mem-deepseek-harness` repo and mirrored in `nowledge-co/community`.

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

The bundle connects to the local Mem MCP endpoint by default:

```text
http://127.0.0.1:14242/mcp/
```

For Nowledge Cloud or another remote Mem, set:

```sh
export NMEM_MCP_URL="https://<workspace>/mcp"
export NMEM_API_KEY="<mem-api-key>"
```

## What It Does

- Injects the Nowledge Mem Context Bundle once per DSH session through `agent/pre-step`.
- Runs prompt-time memory recall for continuation, release, regression, connector, plugin, and other recall-shaped prompts.
- Adds the Mem MCP server through DSH's `@deepseek-ai/dsh-mcp-client`, so tools appear as `mcp__nowledge_mem__...`.
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

After each completed DSH turn, the plugin serializes user, assistant, and tool-result events, skips its own injected context messages, and imports the transcript into Mem as `source=deepseek-harness`.

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
