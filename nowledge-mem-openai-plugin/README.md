# Nowledge Mem Cloud for ChatGPT and Codex

This is the public OpenAI plugin package for using a Nowledge Mem Cloud workspace from ChatGPT and Codex.

The checked-in package is intentionally skills-only. OpenAI requires an `.app.json` entry to reference a production MCP connection registered in ChatGPT developer mode. That registration has not produced a technical `plugin_asdk_app_…` ID yet, so this repository does not contain an invented ID or a placeholder `.app.json`.

## Current package

- `.codex-plugin/plugin.json`: universal ChatGPT/Codex plugin metadata
- `skills/nowledge-mem/SKILL.md`: the host-independent memory workflow and safety boundary
- `scripts/finalize-app-connection.mjs`: owner-only finalization after OpenAI returns the real technical ID
- `SUBMISSION.md`: registration, validation, smoke, and public-directory handoff

The package contains no workspace URL, credential, or user-specific Access Anywhere address. The production connection must point to the stable public Nowledge Mem Cloud `/mcp` endpoint and complete OAuth per user.

## Separate local connector

This package does not replace `nowledge-mem-codex-plugin`. The dedicated Codex connector provides local MCP, lifecycle hooks, startup context, and transcript capture. The public Cloud plugin provides portable skills and the registered hosted MCP connection; MCP alone does not capture ChatGPT or Codex conversations.

## Validation

```bash
python3 nowledge-mem-openai-plugin/tests/test_openai_plugin.py
```

Maintainers should additionally run the `plugin-creator` package validator
available in their Codex installation before submission. The repository test is
self-contained and is the cross-platform CI contract.

Licensed under this repository's MIT license.
