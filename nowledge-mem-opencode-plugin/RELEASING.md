# Releasing OpenCode

The complete npm/PyPI/ClawHub workflow and authorization matrix is in
[`docs/PLUGIN_PUBLISHING.md`](../docs/PLUGIN_PUBLISHING.md).

Keep package.json, package-lock.json, integrations.json, the changelog and active
installation pins aligned in a release PR. OpenCode 1.x still uses 0.3.10;
0.4.x is the OpenCode 2.x line.

## Manual npm publication

Run from a clean, reviewed checkout of the release commit:

```sh
cd nowledge-mem-opencode-plugin
npm ci --ignore-scripts
npm test
npm run check
node scripts/release.mjs check
git diff --exit-code -- dist/index.js
npm pack --json > pack.json
npm login
npm whoami
npm publish opencode-nowledge-mem-0.4.2.tgz --access public --tag latest
node scripts/release.mjs verify pack.json
```

Publish the tested tarball. Do not bump the version with npm version alone;
that leaves the integration registry behind. Update the tarball filename for
the next version. Manual publication can ask for an npm 2FA code.

## GitHub trusted publishing

After the workflow is merged, open the npm package's Settings → Trusted
Publisher and configure GitHub Actions:

- Organization: `nowledge-co`
- Repository: `community`
- Workflow filename: `publish-opencode.yml`
- Environment: leave empty (this workflow has no GitHub Environment)
- Allow direct `npm publish` if the settings page offers action permissions

Use GitHub-hosted runners; the workflow uses Node 24 and npm 11.6.2 with
`id-token: write`. No npm token secret is required. See the
[npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

For a future release, merge its tested version bump first, then dispatch with
the exact reviewed main commit:

```sh
gh workflow run publish-opencode.yml --repo nowledge-co/community --ref main \
  -f version=0.4.2 -f commit=<full-reviewed-main-commit-sha>
```

The workflow rejects a version mismatch or a commit outside main. It tests and
packs before publishing, verifies the published tarball integrity and latest
tag, and uploads a pack receipt. An already-published version is not overwritten;
verify that existing artifact rather than rerunning its publication.
