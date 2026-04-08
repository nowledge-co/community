# Releasing the Cursor Plugin

This package lives inside the `community` repository, so Cursor Marketplace readiness must account for two layers:

- the plugin package itself at `nowledge-mem-cursor-plugin/`
- the repository-level `.cursor-plugin/marketplace.json` manifest Cursor uses for multi-plugin repositories

## Why This Release Path

Cursor's plugin docs support repositories that contain multiple plugins.

Because `community` contains many integrations and only one Cursor plugin package today, the repository root now carries `.cursor-plugin/marketplace.json` and points `nowledge-mem-cursor` at `nowledge-mem-cursor-plugin/`.

That keeps the package clean while making the repository submission path explicit.

## Validate Locally

```bash
cd community/nowledge-mem-cursor-plugin
node scripts/validate-plugin.mjs
```

This validator checks:

- required plugin files exist and are non-empty
- `.cursor-plugin/plugin.json` has the core marketplace metadata
- `hooks/hooks.json` and `hooks/session-start.mjs` keep the session-start Working Memory bootstrap wired
- `mcp.json` has a valid `nowledge-mem` server entry
- the rule still documents honest `save-handoff` / `save-thread` semantics
- rule and skill files keep the frontmatter Cursor's template expects
- the repository-level `.cursor-plugin/marketplace.json` points to this package

## Manual Readiness Checks

These still require a real Cursor IDE validation pass before submission:

- install the local package through Cursor's documented local plugin path:
  `~/.cursor/plugins/local/<plugin-name>`
- confirm the rule is applied and all four skills are discovered
- confirm the `sessionStart` hook injects Working Memory when `nmem` is installed
- confirm MCP connects locally
- confirm remote MCP configuration works when URL and headers are updated
- confirm `save-handoff` works when `nmem` is present
- confirm the package does not expose or claim `save-thread`
- if Cursor still shows Claude-oriented hooks or `save-thread`, remove the stale imported `nowledge-mem` package and retry with only `~/.cursor/plugins/local/nowledge-mem-cursor`

## Marketplace Submission

The official Cursor plugin template frames submission as a repository-link
review flow with the Cursor team. Use the current marketplace submission path
that Cursor exposes for repository review, and make sure the repository you
submit is public and rooted at the multi-plugin `community` checkout.

Before submitting, confirm that the root `.cursor-plugin/marketplace.json`
still points to `nowledge-mem-cursor-plugin`.

The package id must stay `nowledge-mem-cursor`. Reusing `nowledge-mem` causes
Cursor to collide with the imported Claude-oriented package surface and hides
the real local Cursor package during testing.

## Recommended Publish Form Values

Use stable, package-specific values when filling the submission form:

- Organization name: `Nowledge Labs`
- Organization handle: `nowledge-labs`
- Contact email: `hello@nowledge-labs.ai`
- GitHub repository: `https://github.com/nowledge-co/community`
- Website URL: `https://mem.nowledge.co/docs/integrations/cursor`
- Logo URL: `https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-cursor-plugin/assets/logo.png`
- Short description: `Bring Working Memory, memory recall, and handoff summaries into Cursor with Nowledge Mem.`

Prefer the docs page over the site homepage for the website field so reviewers land directly on setup instructions. Prefer the raw GitHub logo URL over ephemeral upload links so the asset remains stable during review.

## Submission Checklist

- run `node scripts/validate-plugin.mjs`
- review `README.md` for accurate install/configuration instructions
- confirm `plugin.json` metadata is final: name, description, author, homepage, repository, license
- confirm the repository-level `.cursor-plugin/marketplace.json` is valid and committed
- confirm `hooks/hooks.json` still uses only the minimal, intentional `sessionStart` automation
- manually test local install via `~/.cursor/plugins/local/<plugin-name>` with local Mem
- manually test in Cursor IDE with remote Mem MCP configuration
- verify that `save-handoff` is present and `save-thread` is not claimed
- submit the repository link through Cursor's marketplace publish page
- verify the marketplace listing points users to the correct docs page
