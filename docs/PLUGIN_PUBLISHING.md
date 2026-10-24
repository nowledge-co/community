# Publishing established plugin packages

Maintainer agent entrypoint: [plugin-release skill](../.agents/skills/plugin-release/SKILL.md).

Use the package version and a full reviewed SHA already merged into `main`.
These workflows are deliberately manual: merging or editing an integration does
not publish it. Select **main** when dispatching. Inputs are allowlisted; a
version must match package metadata, the integration registry and the release
changelog. npm/PyPI reject existing versions rather than silently skipping them.
Stable releases advance `latest`; prereleases need a separate release policy.

| Distribution | Package / slug | Workflow filename | Setup |
| --- | --- | --- | --- |
| npm | opencode-nowledge-mem | publish-opencode.yml | npm Trusted Publisher |
| npm | @nowledge/openclaw-nowledge-mem | publish-npm-plugins.yml | npm Trusted Publisher |
| npm | nowledge-mem-pi | publish-npm-plugins.yml | npm Trusted Publisher |
| npm | nowledge-mem-omp | publish-npm-plugins.yml | npm Trusted Publisher |
| npm | nowledge-mem-step-code | publish-npm-plugins.yml | npm Trusted Publisher |
| PyPI | nowledge-mem-bub | publish-pypi-plugins.yml | PyPI Trusted Publisher |
| PyPI | nowledge-mem-langgraph | publish-pypi-plugins.yml | PyPI Trusted Publisher |
| ClawHub | @nowledge/openclaw-nowledge-mem (code-plugin) | publish-clawhub.yml | Trusted Publisher + clawhub environment |

Pydantic AI, development benchmarks, Git/host-store integrations and the separate
Gemini submodule are not implicitly added to these registry publishers. A package
manifest alone does not make npm or PyPI its distribution contract.

## Provider setup (once per package)

### npm

In **each package's** Settings → Trusted Publisher, choose GitHub Actions:

- Organization/user: `nowledge-co`
- Repository: `community`
- Workflow: exact filename from the table, not a path
- Environment: blank (the npm workflows do not declare one)
- Allow `npm publish`: enabled, because these workflows publish directly
- Extra `npm dist-tag` management: not needed

No npm token or GitHub `NPM_TOKEN` secret is required. GitHub-hosted Ubuntu,
Node24 and npm11.6.2 are used. A saved configuration may still be **Pending
validation** with a deadline shown by npm; a real successful OIDC publish is
needed. Do not republish an immutable version just to validate trust. If the
window expires before an intentional release, recreate the connection when
ready. See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

Every npm manifest must also declare the public `nowledge-co/community` Git
repository and its package subdirectory. The release guard checks this before
upload: provenance requires the repository to match the publishing workflow.
See [npm provenance prerequisites](https://docs.npmjs.com/generating-provenance-statements/#prerequisites).

### PyPI

For both existing projects, configure GitHub Trusted Publishing:

- Owner: `nowledge-co`
- Repository: `community`
- Workflow: `publish-pypi-plugins.yml`
- Environment: blank (the publish job does not declare one)

Only the publish job has `id-token: write`. It downloads the wheel and sdist
from the tested build job; it does not check out source or run package build
scripts with publishing credentials. No PyPI API token is used.
See [PyPI Trusted Publishers](https://docs.pypi.org/trusted-publishers/using-a-publisher/).

### ClawHub

Create GitHub environment `clawhub`, restrict it to branch `main`, and
configure reviewers according to release ownership. Configure the scoped
code-plugin's Trusted Publisher from an authorized ClawHub account:

```sh
clawhub package trusted-publisher set @nowledge/openclaw-nowledge-mem \
  --repository nowledge-co/community --workflow-filename publish-clawhub.yml \
  --environment clawhub
clawhub package trusted-publisher get @nowledge/openclaw-nowledge-mem
```

The workflow pins ClawHub0.23.3 and uses GitHub OIDC; no `CLAWHUB_TOKEN`
secret or manual-override token is provided. Failed OIDC authentication therefore
cannot fall back to a stored account credential on the fresh runner.

The actual package is family `code-plugin`, name
`@nowledge/openclaw-nowledge-mem`, owner `nowledge`. The separate
`nowledge-mem` skill listing (owner `wey-gu`) is **not** the plugin runtime
and must never be used as its publication or acceptance signal.

The CLI packs one tested npm-format ClawPack, previews it with
`package publish --dry-run`, then publishes that exact tarball with the
reviewed repo/SHA/subpath and waits for definitive publication. Readback checks
package identity, family, owner, version/latest, artifact SHA256/npm integrity,
and server-recorded source repo/SHA/path. Do not claim provenance from a source
link alone: inspect the returned verification tier separately.

## Release procedure

1. Bump the selected package, registry and all active version-bearing surfaces
   together; add release notes and run the package tests.
2. Merge the reviewed release PR. Record its full SHA.
3. Confirm package-specific provider setup from the table.
4. Dispatch the appropriate workflow. Do not choose an arbitrary branch or moving
   main in place of the reviewed SHA.
5. Inspect the build/test, publication and registry-verification jobs. A green
   build without successful publication and verification is not a shipped release.
6. Download the receipt/artifacts and perform the host install smoke described
   by the plugin's own release guide. Unit and static tests are not real host or
   remote-backend acceptance.

Examples (replace placeholders with the reviewed values):

```sh
gh workflow run publish-npm-plugins.yml --repo nowledge-co/community --ref main \
  -f plugin=pi -f version=<NEW_VERSION> -f commit=<FULL_MAIN_SHA>
gh workflow run publish-pypi-plugins.yml --repo nowledge-co/community --ref main \
  -f plugin=langgraph -f version=<NEW_VERSION> -f commit=<FULL_MAIN_SHA>
gh workflow run publish-clawhub.yml --repo nowledge-co/community --ref main \
  -f version=<NEW_VERSION> -f commit=<FULL_MAIN_SHA> \
  -f changelog='<PUBLIC_RELEASE_NOTES>'
```

OpenClaw has **two** independent publications. Run and verify npm and ClawHub
separately using the same reviewed version/SHA; success on one does not imply the
other succeeded. Retry only the failed channel after checking its registry.
Never bump a version merely to hide a failed job.

Registry publication can succeed before public JSON endpoints expose the version.
Verification polls only read endpoints (404 or a not-yet-current latest tag),
with up to 61 reads and five seconds between attempts per lookup. Authentication,
rate-limit/server failures and artifact mismatches are not retried. Preflight
still treats only 404 as absence and never retries an upload.

If an npm/PyPI upload succeeded but its verification failed, use read-only receipt
recovery rather than rerunning publication:

```sh
gh workflow run verify-plugin-release.yml --repo nowledge-co/community --ref main \
  -f plugin=pi -f version=<PUBLISHED_VERSION> -f commit=<ORIGINAL_RUN_SHA> \
  -f receipt_run=<ORIGINAL_PUBLISH_RUN_ID>
```

This validates the original completed main-dispatch run, workflow identity,
source SHA, package/version and retained hashes, without `id-token: write` or
registry credentials. If no original artifact remains, do not substitute a local
rebuild as proof of what was uploaded.

ClawHub OIDC publication must omit `--owner`: the registry derives the owner from
the Trusted Publisher. Preview and readback still require owner `nowledge`.
It also requires `source-commit` to equal the authorized workflow run SHA.
Use the OIDC source ref (`refs/heads/main`) for `--source-ref`; do not put the
commit SHA in that field.
Unlike npm/PyPI, an older reviewed main ancestor is insufficient: review current
main and dispatch that exact SHA. The workflow rejects a main-advance race before
upload. If npm already shipped before a publisher-only repair, retain its original
receipt, record the distinct ClawHub source SHA, and check that package files are
unchanged between the two SHAs. Never pretend the attestations share a commit.

PyPI receipts are the exact wheel/sdist artifacts retained by Actions; verification
compares both filenames and SHA256 hashes with PyPI. npm retains `pack.json`
and verifies its integrity against the published version and latest tag.

### Embedded shared core

OpenCode, Pi, and OpenClaw embed the private [TypeScript core](../shared/plugin-core/README.md)
in their own artifacts. Shared-source changes trigger all core consumers,
including Pi's OMP and Step Code wrappers. Build and freshness checks run before
packing; installation does not fetch the core or run a compiler.

Their publisher receipts retain `core-receipt.json`, the original tarball, and
`pack.json` together. The core receipt binds the reviewed source SHA, plugin
version, embedded content manifest, and exact tarball hashes. Verification-only
recovery checks that original receipt and payload without rebuilding or upload
credentials. Older releases without an embedded core retain their existing
receipt contract.

OpenClaw's npm and ClawHub releases each retain their own original tarball,
pack metadata, and `core-receipt.json`. The ClawHub receipt verifies its pinned
CLI's pack object and SHA-256 as well as npm-format integrity. A receipt from
one channel is not evidence for the other. npm verification-only recovery uses
the reviewed source's consumer list so older OpenClaw artifacts without an
embedded core keep their earlier contract.

Amp uses the same embedded core through Git/copy installation. Its package
manifest is not an npm publishing contract. Validate the copied entrypoint and
payload using the shared artifact checks.

Alma also embeds the core through folder-based delivery. Include its complete
`generated/plugin-core` directory in the marketplace mirror and manual copies;
the source and marketplace embedded manifests must match byte-for-byte. Shared
artifact checks validate file hashes and load the complete copied plugin with a
host double. They do not publish an npm package or prove live Alma acceptance.

## Git and external marketplace delivery

Shipped skills, rules, commands and prompt guidance are plugin behavior, not
unversioned documentation. Bump every affected plugin manifest and registry
entry, including Claude Code/Grok's shared package, even for guidance-only
changes. Git-backed packages and npx skills do not implicitly publish to npm;
use their actual marketplace/Git install contract.

Alma's marketplace ships from `yetone/alma-plugins`, not from this repository.
After the community release is merged, synchronize the complete Nowledge Mem
runtime/skills/docs package to `plugins/nowledge-mem` in that repository and
update its package/manifest plus the `registry.json` version in the same PR.
The maintained checkout is `/Users/weyl/dev/alma-plugins`; keep unrelated
changes intact and submit from the maintainer fork. Record the reviewed
community source SHA and upstream PR. An open external PR is pending review,
not marketplace delivery; verify the upstream merge and registry/package
parity before calling that channel shipped.

Repository-linked external catalogs (such as Grok Build) should keep their
existing source paths. Check the catalog's actual reference/pin before opening
an update: do not create a synthetic publisher or resubmit an unchanged
moving-Git reference. Grok Build and Grok Bot are distinct delivery surfaces.

## Local release guard tests

```sh
python3 -m unittest discover -s scripts -p 'test_plugin_release.py' -v
actionlint .github/workflows/publish-*.yml .github/workflows/plugin-release-contract.yml
```

Workflow setup and provider grants do not publish packages. After every release
PR, record the exact merged SHA, registry receipts, and remaining host-smoke
gates; do not treat a source merge as artifact delivery.
