---
name: plugin-release
description: Prepare and verify community plugin releases to npm, PyPI, or ClawHub, including trusted-publisher setup and failed publication recovery. Use for maintainer release work, not end-user plugin installation or the separate Gemini submodule release cycle.
---

# Release community plugins

Read [the publishing runbook](../../../docs/PLUGIN_PUBLISHING.md) for the
package/workflow matrix, authorization fields, commands, and receipt checks.
Read the selected package's `RELEASING.md` when present for host-specific
acceptance. Run commands from the repository root unless stated otherwise.

## Select the release

- Identify the requested package and real distribution channel from
  `integrations.json`; a package manifest alone is not a publish contract.
- Inspect current registry versions and changes since the last shipped artifact.
  Distinguish release preparation, published artifacts, and real host acceptance.
- Preserve unrelated work. Update the selected manifest, lockfile, registry,
  changelog, runtime diagnostic version, and active pins together. Account for
  remaining old-version occurrences; preserve historical notes and compatibility
  tracks (OpenCode 1.x stays on 0.3.10).
- Use stable X.Y.Z versions for these workflows. Do not overwrite an existing
  version, downgrade `latest`, or invent a bump merely to hide a failed run.
  A first OIDC maintenance release must say what delivery changed; do not claim
  runtime fixes that did not occur.

## Prepare and review

Run the selected plugin's focused tests and relevant registry/install contracts,
then `python3 scripts/plugin-release.py preflight <plugin> <version>` and
`python3 -m unittest discover -s scripts -p 'test_plugin_release.py' -v`.
Check edited workflows with actionlint. Inspect the exact pack or wheel/sdist,
not just source files. Use disposable install roots/profiles for smokes; do not
write to the user's active agent config or Mem data to test packaging.

Merge the reviewed release PR before publication. Record its full 40-character
SHA and confirm it is an ancestor of `origin/main`. Dispatch with `--ref main`
and the exact `commit` input, never substitute moving main or a release branch.
The workflow code on main and the selected artifact SHA both require review.

## Authorization and dispatch

Verify each package's Trusted Publisher matches the runbook's repository,
workflow filename, and environment. Do not collect passwords/OTPs, add long-lived
token fallback, weaken 2FA, or broaden grants to make a failed run pass.
Saved npm grants can be Pending validation with a short deadline: record the
displayed deadline and validate with an intentional new release. If it expires,
re-establish the grant when ready rather than republishing an immutable version.

Use the runbook's channel-specific dispatch commands. Capture the run ID and
requested version/SHA; wait for terminal build, publish, and verify results.

OpenClaw needs independent npm and ClawHub receipts for the same version/SHA.
The ClawHub runtime is scoped `@nowledge/openclaw-nowledge-mem`, family
`code-plugin`, owner `nowledge`. The `nowledge-mem` skill listing is not runtime
acceptance. Use the workflow-pinned code-plugin-capable CLI, not the legacy
skill-only CLI. Do not claim verified provenance from a source URL alone.

## Acceptance and recovery

Download retained receipts. npm must match the tested tarball integrity and
`latest`; PyPI must match both wheel and sdist filenames/SHA256 and `latest`;
ClawHub must match identity/family/owner, artifact SHA256/npm integrity,
source repo/SHA/path and `latest`. Report the returned provenance tier honestly.
Run isolated install/load smoke from the shipped artifact, separately from any
authorized live App/Cloud functional smoke; packaging does not prove backend use.

On failure, stop publication retries and inspect the failed step plus the remote
registry first. A failed post-publish check may mean the version already exists.
If present, verify its retained receipt instead of re-uploading. If absent, fix
and review the cause, then retry only the failed channel with a reviewed SHA.
Never switch to a personal token or silently publish another version.

For npm/PyPI readback failures after a successful upload, use the runbook's
`verify-plugin-release.yml` recovery workflow: it downloads the original run's
receipt, checks its main/source/workflow identity, and verifies without publishing
credentials. Do not rerun a combined npm publish job against an existing version.
ClawHub Trusted Publishing derives the owner from the grant; the upload command
must not pass an owner override. Keep the expected owner in preview/readback.

Handoff per channel: package/version, artifact SHA, workflow run, receipt result,
provenance, host-smoke result, and remaining blockers. Do not call a green build
a shipped release or close acceptance work while publish/verification is pending.
