# Releasing the Droid Plugin

This package lives inside the `community` repository, so Droid marketplace readiness must account for two layers:

- the plugin package itself at `nowledge-mem-droid-plugin/`
- the repository-level `.factory-plugin/marketplace.json` manifest Droid uses for the multi-plugin marketplace

## Why This Release Path

Factory Droid supports repository-backed plugin marketplaces. That matches the existing `community` model better than a dedicated standalone repository.

Use a separate repository only if Droid later requires repo-root release/discovery mechanics that the shared `community` repository cannot satisfy cleanly.

Factory still expects a `version` field in `.factory-plugin/plugin.json`, but Droid updates plugins by Git commit from the marketplace repository. Treat the manifest version as package metadata, not as the thing Droid resolves installs against.

## Validate Locally

```bash
cd community
node nowledge-mem-droid-plugin/scripts/validate-plugin.mjs
```

This validator checks:

- required plugin files exist and are non-empty
- `.factory-plugin/plugin.json` has the core plugin metadata
- the package exposes `save-handoff` and does not pretend to expose transcript-backed `save-thread`
- the repository-level `.factory-plugin/marketplace.json` points to this package
- no files claim unsupported `nmem t save --from droid` behavior

## Manual Readiness Checks

These still require a real Droid validation pass:

- add the local checkout as a marketplace with `droid plugin marketplace add .`
- install `nowledge-mem@nowledge-community`
- confirm hooks load without manifest or schema errors
- confirm slash commands are discovered
- confirm Working Memory loads at session start
- confirm search and distillation guidance behave correctly
- confirm remote Mem configuration works through `~/.nowledge-mem/config.json`
- confirm the package exposes `save-handoff` and does not claim `save-thread`

## Suggested Publish Flow

```bash
cd community
droid plugin marketplace add .
droid plugin install nowledge-mem@nowledge-community
```

For a public repository-backed marketplace:

```bash
droid plugin marketplace add https://github.com/nowledge-co/community
droid plugin install nowledge-mem@nowledge-community
```

## Release Checklist

- update `.factory-plugin/plugin.json` version when the package contract changes in a user-visible way
- update `CHANGELOG.md`
- run `node nowledge-mem-droid-plugin/scripts/validate-plugin.mjs` from `community/`
- confirm the repository-level `.factory-plugin/marketplace.json` still points at `./nowledge-mem-droid-plugin`
- keep the marketplace and plugin manifests aligned with Factory's documented schema
- manually install and test in Droid
- verify local and remote `nmem` behavior
- verify README matches actual behavior

If Factory introduces a different publish/discovery contract later, update this file and the main integration publishing checklist in the same change.
