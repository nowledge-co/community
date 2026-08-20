# Nowledge Mem for ChatGPT and Codex

This is the OpenAI universal plugin package for Nowledge Mem. OpenAI's public
plugin directory is shared by ChatGPT and Codex, so one reviewed listing can
provide the same Cloud memory surface to both products.

## What it provides

- Working Memory and context retrieval at the start of a task
- Search across memories and prior threads
- Explicit distillation of durable decisions and procedures
- Explicit handoff and thread-save workflows
- Status checks for the connected Nowledge Mem workspace

The package uses the production Cloud MCP endpoint:

```text
https://cloud.nowledge.co/mcp
```

The host owns the OAuth 2.1 authorization flow. This package contains no
credentials, local secrets, install scripts, or machine-specific URLs.

## Important capability boundary

ChatGPT does not receive Codex's local lifecycle hooks or a local transcript
file. This package therefore does not claim automatic full-thread capture in
ChatGPT. Use the explicit save-thread or handoff skill when a durable record is
needed. Codex users should prefer the dedicated Nowledge Mem Codex connector,
which can install Codex-specific hooks without changing ChatGPT behavior.

The package also does not replace the dedicated connectors for other agents.
Those connectors remain the right choice when a host offers lifecycle hooks,
native identity, or transcript import.

## Review and release state

The repository package is ready for OpenAI plugin submission materials. Public
listing requires a verified OpenAI developer or business identity, a reachable
production MCP endpoint, standardized OAuth metadata, and OpenAI tool scanning.
Do not submit this package until those Cloud checks are complete.

Submission handoff: [`SUBMISSION.md`](./SUBMISSION.md).

## Local development

Validate the package without contacting production:

```bash
python3 tests/test_openai_plugin.py
```
