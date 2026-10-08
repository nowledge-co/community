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

PyPI receipts are the exact wheel/sdist artifacts retained by Actions; verification
compares both filenames and SHA256 hashes with PyPI. npm retains `pack.json`
and verifies its integrity against the published version and latest tag.

## Local release guard tests

```sh
python3 -m unittest discover -s scripts -p 'test_plugin_release.py' -v
actionlint .github/workflows/publish-*.yml .github/workflows/plugin-release-contract.yml
```

Workflow setup and provider grants do not publish packages. After every release
PR, record the exact merged SHA, registry receipts, and remaining host-smoke
gates; do not treat a source merge as artifact delivery.
