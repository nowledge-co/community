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

`npm pack` is not enough on its own. ClawHub publishes the plugin from the
working tree and honors `.clawhubignore`, not npm's `files` whitelist. Keep the
two release surfaces aligned so test and build-only files do not leak into the
published code plugin.

The installed ClawHub CLI 0.8.0 has no publish dry-run. Validate the package
locally, then run the publish command only after the OpenClaw install smoke
passes. The publisher is taken from the authenticated `clawhub` account.

```bash
clawhub --workdir "$PWD" publish . \
  --slug nowledge-mem \
  --version 0.8.34 \
  --tags latest \
  --changelog "OpenClaw 2.0 Incognito-safe automatic capture and package-version diagnostics"
```

## Manual Readiness Checks

These still need a real OpenClaw install smoke test:

- install from ClawHub with `openclaw plugins install clawhub:nowledge-mem`
- install from the local folder with `openclaw plugins install --link .`
- confirm the plugin loads without manifest or config-schema errors
- confirm the memory slot switches to `openclaw-nowledge-mem`
- confirm `memory_search` and `nowledge_mem_save` are exposed
- confirm `sessionContext` remains off by default
- confirm session-end thread capture and distillation work
- confirm remote Mem mode works with `apiUrl` and `apiKey`
- confirm `corpusSupplement` avoids duplicate recall when enabled
- run the isolated smoke against OpenClaw `2026.8.1` or a newer supported host
- verify an Incognito session does not create or append a Mem Thread, while an
  explicit memory tool call still works

## Publish

Before publishing, confirm the package is owned by the `nowledge` publisher.
The package name is scoped as `@nowledge/openclaw-nowledge-mem`, and ClawHub
enforces that the scoped package owner exists and matches:

```bash
clawhub inspect nowledge-mem
```

If the owner is not `nowledge`, transfer it before publishing another version:

```bash
clawhub whoami
```

Publish after the readiness checks:

```bash
clawhub --workdir /path/to/community/nowledge-mem-openclaw-plugin publish . \
  --slug nowledge-mem \
  --version 0.8.34 \
  --tags latest \
  --changelog "OpenClaw 2.0 Incognito-safe automatic capture and package-version diagnostics"
```

If your globally installed `clawhub` CLI is older or does not support the
`publish` options above, update the CLI before publishing. Do not use the old
`package publish` syntax; it is not accepted by ClawHub CLI 0.8.0.

```bash
clawhub --help
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
- keep the package, manifest, integration registry, and runtime Context Engine version aligned
- keep `openclaw.install.minHostVersion` omitted for this plugin; `scripts/validate-plugin.mjs` enforces this and is the source of truth if the policy ever changes
- keep `.clawhubignore` aligned with the npm package surface so ClawHub releases do not ship tests or build-only files
- run `node scripts/validate-plugin.mjs`
- run `npm pack --dry-run`
- run `clawhub whoami` and confirm the intended publisher is logged in
- run `clawhub inspect nowledge-mem` when an existing listing is expected
- run `clawhub --workdir "$PWD" publish . --slug nowledge-mem --version 0.8.34 --tags latest`
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
