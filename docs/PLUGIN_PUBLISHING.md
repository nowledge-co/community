# Publishing established plugin packages

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
| ClawHub | nowledge-mem | publish-clawhub.yml | clawhub environment + token |

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

Create GitHub environment `clawhub`, restrict it to `main`, and configure
required reviewers according to the team's release ownership. Add environment
secret `CLAWHUB_TOKEN` for an account authorized to publish the existing
`nowledge-mem` listing. The observed listing owner is `wey-gu`; the npm
`@nowledge` scope does **not** establish ClawHub ownership. Do not transfer the
listing or assume a new publisher account has access.

ClawHub0.8.0 is pinned to the already-used publishing flow. That CLI has no
publish dry-run and automatically accepts ClawHub's license terms when publishing.
Dispatch only after the owner has reviewed those terms and the public changelog.
The token is supplied only to the login/publish step and logged out afterward.
The GitHub environment approval gate is separate from registry authentication.

ClawHub and npm have different file selection rules. The receipt helper uses the
pinned CLI's own file selection code, including `.clawhubignore`, to hash the
exact expected upload. Post-publish verification checks the full file set,
SHA256 hashes, explicit version and latest tag. This is not GitHub provenance:
ClawHub0.8.0 does not attach an OIDC attestation or reviewed source SHA to its
upload. The workflow run and uploaded receipts carry the source-commit evidence.

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

This CI change does not bump Bub, LangGraph or other current versions, configure
their registry permissions, or publish anything. In particular, LangGraph's
unreleased code still requires a reviewed version bump before publication.
