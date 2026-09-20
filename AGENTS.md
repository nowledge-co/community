# Nowledge Community Agent Guide

Read `CLAUDE.md` for the repository's full integration, install-contract, and
submodule guidance.

## Integration Release Contract

`integrations.json` is the canonical registry for every Nowledge Mem
integration. A plugin version bump is incomplete until all version-bearing
surfaces agree.

When changing an integration's version:

1. Update the package manifest, such as `plugin.yaml`, `plugin.json`,
   `package.json`, or the host-specific equivalent.
2. Update the matching integration's `version` in `integrations.json` in the
   same pull request.
3. Update changelogs, documentation, lockfiles, and tests that intentionally
   pin the released version.
4. Run the integration's focused test suite and the relevant registry or
   plugin contract tests.

Before approving or merging an integration release, search the repository for
the previous version and account for every remaining occurrence. Historical
changelog entries may remain unchanged; active manifests, registry entries,
install metadata, and release assertions must not disagree.
