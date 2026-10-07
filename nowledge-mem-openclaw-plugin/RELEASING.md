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

Use a ClawHub CLI that supports `package publish`. Check its help before
publishing; older CLIs may only support skill publication. The code plugin is
`@nowledge/openclaw-nowledge-mem`. The separate `nowledge-mem` skill listing
does not install the plugin runtime.

Preview the code-plugin package and its file list without uploading:

```bash
clawhub package publish --help
clawhub package publish . \
  --family code-plugin \
  --name @nowledge/openclaw-nowledge-mem \
  --owner nowledge \
  --version 0.8.34 \
  --tags latest \
  --source-repo nowledge-co/community \
  --source-commit "$(git rev-parse HEAD)" \
  --source-path nowledge-mem-openclaw-plugin \
  --dry-run
```

Confirm that the preview excludes tests and build-only files. Run the publish
command only after the OpenClaw install smoke passes. See the
[ClawHub CLI command definitions](https://github.com/openclaw/clawhub/blob/main/packages/clawhub/src/cli.ts)
for the package and skill publication interfaces.

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
- run the isolated smoke against OpenClaw `2026.8.1` or a newer supported host
- verify an Incognito session does not create or append a Mem Thread, while an
  explicit memory tool call still works

## Publish

Before publishing, confirm the package is owned by the `nowledge` publisher.
The package name is scoped as `@nowledge/openclaw-nowledge-mem`, and ClawHub
enforces that the scoped package owner exists and matches:

```bash
clawhub package inspect @nowledge/openclaw-nowledge-mem
clawhub whoami
```

Confirm that the listing has family `code-plugin` and owner `nowledge`, and that
the authenticated account can publish under that owner. Resolve any ownership
or trusted-publisher gate before publishing.

Publish after the readiness checks:

```bash
clawhub package publish . \
  --family code-plugin \
  --name @nowledge/openclaw-nowledge-mem \
  --owner nowledge \
  --version 0.8.34 \
  --tags latest \
  --source-repo nowledge-co/community \
  --source-commit "$(git rev-parse HEAD)" \
  --source-path nowledge-mem-openclaw-plugin \
  --wait \
  --changelog "OpenClaw 2.0 Incognito-safe automatic capture and package-version diagnostics"
```

If your globally installed `clawhub` CLI is older or does not support the
`package publish` options above, update it through the development machine's
tool manager before publishing. After publication, inspect the scoped package
again and confirm the intended version is available as a `code-plugin`.

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
- keep `package.json` `openclaw.install.clawhubSpec`, `openclaw.install.npmSpec`, `openclaw.compat`, and `openclaw.build` aligned with the tested OpenClaw baseline
- keep the package, manifest, integration registry, and runtime Context Engine version aligned
- keep `openclaw.install.minHostVersion` omitted for this plugin; `scripts/validate-plugin.mjs` enforces this and is the source of truth if the policy ever changes
- inspect the package dry-run file list so ClawHub releases do not ship tests or build-only files
- run `node scripts/validate-plugin.mjs`
- run `npm pack --dry-run`
- run `clawhub whoami` and confirm the intended publisher is logged in
- run `clawhub package inspect @nowledge/openclaw-nowledge-mem` and confirm family `code-plugin`
- run the `clawhub package publish . --family code-plugin --name @nowledge/openclaw-nowledge-mem --owner nowledge --dry-run` preview above
- manually test install in OpenClaw
- publish the scoped code plugin to ClawHub and read back its family, owner, and version
- optionally publish to npm after the ClawHub release is confirmed

## Recommended Listing Values

Use these stable values if you need to fill any manual reviewer form:

- Publisher: `Nowledge Labs`
- Contact: `hello@nowledge-labs.ai`
- Repository: `https://github.com/nowledge-co/community`
- Docs: `https://mem.nowledge.co/docs/integrations/openclaw`
- Summary: `Cross-tool knowledge graph memory for OpenClaw with Working Memory, graph search, and session distillation.`
