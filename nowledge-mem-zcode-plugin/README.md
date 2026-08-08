# Nowledge Mem for ZCode

> A ZCode Plugin package that adds guided Nowledge Mem MCP tools and reusable Skills.

## What it provides

After the plugin is enabled, ZCode can use the Nowledge Mem MCP server and these Skills:

- `read-working-memory` — read Context Bundle or Working Memory when starting or resuming work
- `search-memory` — proactively search memories and exact prior threads
- `distill-memory` — save durable decisions, procedures, learnings, and context
- `save-handoff` — save a structured, resumable summary when explicitly requested
- `status` — diagnose Nowledge Mem connectivity
- `check-integration` — verify setup and explain the capability contract

This is a guided `MCP + Skills` integration. MCP tools are available to the agent, while Skills teach when to use them. Version 0.1.0 does not claim automatic recall injection, automatic full-transcript capture, pre-compaction capture, or `save-thread`: ZCode's session/transcript lifecycle contract has not been verified for this connector.

## Install from a marketplace

Open a ZCode workspace, then:

1. Open **Settings → Plugins**.
2. Choose **Create → Add marketplace**.
3. Add the repository or a local marketplace directory containing `marketplace.json`.
4. Install and enable `nowledge-mem-zcode`.
5. Reload or restart the ZCode Agent runtime.
6. After local source changes, refresh the marketplace source before testing again.

For a local checkout, add the repository directory or the root `marketplace.json` through the same flow. The package itself is under `nowledge-mem-zcode-plugin/`.

## Mem connection

The package's default `.mcp.json` uses the local Nowledge Mem Desktop endpoint:

```text
http://127.0.0.1:14242/mcp/
```

Start Nowledge Mem Desktop and verify the CLI when using local mode:

```bash
nmem --json status
```

For Cloud, Access Anywhere, self-hosted, or another remote endpoint, configure the ZCode-owned MCP settings rather than editing the installed package:

```bash
nmem config client set url https://mem.example.com
nmem config client set api-key nmem_your_key
nmem config mcp show --host zcode
```

Paste the generated MCP block into ZCode's own MCP settings and reload the Agent runtime. API keys are intentionally absent from this repository and must not be passed as command-line arguments or written to logs. Direct MCP clients do not automatically inherit `~/.nowledge-mem/config.json`.

## Capability contract

| Capability | ZCode behavior in 0.1.0 |
|---|---|
| Context Bundle / Working Memory | Guided by Skills and MCP |
| Memory and thread search | Guided and proactive when relevant |
| Distillation | Guided; search before update/add |
| Status | CLI fallback plus MCP server tools |
| Handoff | Explicit structured summary only |
| Automatic recall injection | Not provided |
| Automatic transcript capture | Not provided |
| Pre-compaction capture | Not provided |
| Full `save-thread` import | Not provided |

A handoff is not a transcript. Do not describe `save-handoff` as lossless session capture.

## Customize without editing the plugin

Do not modify files under ZCode's installed plugin cache. Put project-specific memory guidance in the host's user/project instruction surface when available, or use ZCode's own settings and prompt customization. This keeps changes durable across plugin updates.

## Permissions and security

Enabling a third-party ZCode plugin grants it the permissions provided by its declared components. Review the manifest, `.mcp.json`, and Skills before enabling it. This package contains no executable hook or custom runtime process; its MCP server still has the access granted by the ZCode MCP client and the endpoint you configure.

## Development

Validate the self-contained package without credentials or a running ZCode UI:

```bash
node scripts/validate-plugin.mjs
```

The repository also has a static integration contract test. There is currently no verified headless ZCode plugin harness, so a successful static test is not a claim of live UI verification.
