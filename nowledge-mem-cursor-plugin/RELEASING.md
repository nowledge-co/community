# Releasing the Cursor Plugin

This package lives inside the `community` repository, so Cursor Marketplace readiness must account for two layers:

- the plugin package itself at `nowledge-mem-cursor-plugin/`
- the repository-level `.cursor-plugin/marketplace.json` manifest Cursor uses for multi-plugin repositories

## Why This Release Path

Cursor's plugin docs support repositories that contain multiple plugins.

Because `community` contains many integrations and only one Cursor plugin package today, the repository root now carries `.cursor-plugin/marketplace.json` and points `nowledge-mem` at `nowledge-mem-cursor-plugin/`.

That keeps the package clean while making the repository submission path explicit.

## Validate Locally

```bash
cd community/nowledge-mem-cursor-plugin
node scripts/validate-plugin.mjs
```

This validator checks:

- required plugin files exist and are non-empty
- `.cursor-plugin/plugin.json` has the core marketplace metadata
- `.mcp.json` has a valid `nowledge-mem` server entry
- the rule still documents honest `save-handoff` / `save-thread` semantics
- the repository-level `.cursor-plugin/marketplace.json` points to this package

## Manual Readiness Checks

These still require a real Cursor IDE validation pass before submission:

- install/load the plugin through Cursor's current plugin workflow
- confirm the rule is applied and all four skills are discovered
- confirm MCP connects locally
- confirm remote MCP configuration works when URL and headers are updated
- confirm `save-handoff` works when `nmem` is present
- confirm the package does not expose or claim `save-thread`

## Marketplace Submission

Cursor's docs say to submit the repository link at:

- `https://cursor.com/marketplace/publish`

Before submitting, confirm the repository is public and that the root `.cursor-plugin/marketplace.json` still points to `nowledge-mem-cursor-plugin`.

## Submission Checklist

- run `node scripts/validate-plugin.mjs`
- review `README.md` for accurate install/configuration instructions
- confirm `plugin.json` metadata is final: name, description, author, homepage, repository, license
- confirm the repository-level `.cursor-plugin/marketplace.json` is valid and committed
- manually test in Cursor IDE with local Mem
- manually test in Cursor IDE with remote Mem MCP configuration
- verify that `save-handoff` is present and `save-thread` is not claimed
- submit the repository link through Cursor's marketplace publish page
- verify the marketplace listing points users to the correct docs page
