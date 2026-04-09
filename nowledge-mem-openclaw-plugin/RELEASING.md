# Releasing the OpenClaw Plugin

This package is a standalone OpenClaw code plugin inside the shared `community`
repository. The publish target is **ClawHub** (and optionally npm), not a
repository-level marketplace manifest.

## Why This Release Path

OpenClaw’s native plugin install flow resolves external code plugins from
ClawHub first, then falls back to npm. That means this package needs to satisfy
two contracts:

- a valid OpenClaw package + manifest shape
- the extra `package.json` metadata ClawHub requires for external code plugins

ClawHub specifically validates:

- `openclaw.compat.pluginApi`
- `openclaw.build.openclawVersion`
- `openclaw.plugin.json` present at the package root
- source repository + source commit metadata at publish time

## Local Validation

Before publishing, verify the package itself:

```bash
cd community/nowledge-mem-openclaw-plugin
node scripts/validate-plugin.mjs
npm pack --dry-run
```

Then verify the ClawHub publish contract from a machine with `clawhub` installed:

```bash
cd community/nowledge-mem-openclaw-plugin
clawhub package publish . --dry-run
```

Because this plugin lives in a git repository, ClawHub can infer the source
repository and source commit when you publish from the package directory. If
that inference fails, pass them explicitly:

```bash
clawhub package publish . \
  --source-repo nowledge-co/community \
  --source-commit <git-sha> \
  --source-path community/nowledge-mem-openclaw-plugin \
  --dry-run
```

## Manual Readiness Checks

These still need a real OpenClaw install smoke test:

- install from ClawHub with `openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem`
- install from the local folder with `openclaw plugins install --link .`
- confirm the plugin loads without manifest or config-schema errors
- confirm the memory slot switches to `openclaw-nowledge-mem`
- confirm `memory_search` and `nowledge_mem_save` are exposed
- confirm `sessionContext` remains off by default
- confirm session-end thread capture and distillation work
- confirm remote Mem mode works with `apiUrl` and `apiKey`
- confirm `corpusSupplement` avoids duplicate recall when enabled

## Publish

Dry run first:

```bash
cd /path/to/clawhub
clawhub package publish /path/to/community/nowledge-mem-openclaw-plugin --dry-run
```

Then publish the same package:

```bash
cd /path/to/clawhub
clawhub package publish /path/to/community/nowledge-mem-openclaw-plugin
```

If your globally installed `clawhub` CLI is older and does not support
`package publish --dry-run`, run the newer local clone instead:

```bash
cd /path/to/clawhub
bun clawhub package publish /path/to/community/nowledge-mem-openclaw-plugin --dry-run
```

If you also want npm as a secondary distribution path:

```bash
cd community/nowledge-mem-openclaw-plugin
npm publish --access public
```

## Release Checklist

- bump `version` in `package.json` and `openclaw.plugin.json`
- update `CHANGELOG.md`
- keep `package.json` `openclaw.install.npmSpec`, `openclaw.compat`, and `openclaw.build` aligned with the tested OpenClaw baseline
- keep `openclaw.install.minHostVersion` omitted for this plugin; `scripts/validate-plugin.mjs` enforces this and is the source of truth if the policy ever changes
- run `node scripts/validate-plugin.mjs`
- run `npm pack --dry-run`
- run `clawhub package publish . --dry-run`
- manually test install in OpenClaw
- publish to ClawHub
- optionally publish to npm after the ClawHub release is confirmed

## Recommended Listing Values

Use these stable values if you need to fill any manual reviewer form:

- Publisher: `Nowledge Labs`
- Contact: `hello@nowledge-labs.ai`
- Repository: `https://github.com/nowledge-co/community`
- Docs: `https://mem.nowledge.co/docs/integrations/openclaw`
- Summary: `Cross-tool knowledge graph memory for OpenClaw with Working Memory, graph search, and session distillation.`
