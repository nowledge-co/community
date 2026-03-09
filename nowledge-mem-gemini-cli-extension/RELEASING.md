# Releasing the Gemini CLI Extension

This extension lives inside the `community` repository, so Gemini release readiness should use the **release archive** path from Gemini's extension docs rather than assuming the repository root is the extension root.

## Why This Release Path

Gemini's release docs require `gemini-extension.json` to be at the root of the repository **or the release archive**.

In this repo, the extension lives at `nowledge-mem-gemini-cli-extension/`, not the repository root. That means:

- local development should keep using `gemini extensions link .`
- public release and marketplace discovery should use a packaged archive whose root is this extension directory

## Manual Prerequisites

These are required for Gemini's gallery crawler, but cannot be enforced purely by files in this directory:

- the GitHub repository must be public
- the repository About section must include the `gemini-cli-extension` topic
- the release must be tagged and published on GitHub
- the attached archive must contain `gemini-extension.json` at the archive root

## Validate Locally

```bash
cd community/nowledge-mem-gemini-cli-extension
npm run validate
```

## Build The Release Artifact

```bash
cd community/nowledge-mem-gemini-cli-extension
npm run package:release
```

Or run the full pre-release check:

```bash
cd community/nowledge-mem-gemini-cli-extension
npm run verify:release
```

This produces:

- `dist/nowledge-mem-gemini-cli-extension.tar.gz`
- `dist/nowledge-mem-gemini-cli-extension.tar.gz.sha256`

The archive is intentionally flat at the root so Gemini can inspect it as an installable extension package.

## CI Verification

Pull requests and relevant pushes run the `Validate Gemini Extension` workflow. That workflow validates the manifest and also rebuilds the release archive so packaging drift is caught before tagging.

## Tagging Convention

The GitHub Actions workflow watches tags in this form:

```text
nowledge-mem-gemini-cli-extension-v*
```

Example:

```bash
git tag nowledge-mem-gemini-cli-extension-v0.1.1
git push origin nowledge-mem-gemini-cli-extension-v0.1.1
```

## Initial Public Release

For the first public release, use:

- tag: `nowledge-mem-gemini-cli-extension-v0.1.1`
- release title: `Nowledge Mem Gemini CLI Extension v0.1.1`
- release notes source: `release-notes/0.1.1.md`
- workflow behavior: the release workflow verifies that the pushed tag matches `package.json` and publishes the matching `release-notes/<version>.md` file as the GitHub Release body

## Installation After Release

Once the tagged GitHub Release exists, Gemini users can install from the repository and ref:

```bash
gemini extensions install github.com/nowledge-co/community --ref nowledge-mem-gemini-cli-extension-v0.1.1
```

Gemini's own release docs say GitHub Releases are supported as install sources, and the workflow-created archive is shaped specifically for that path.

## Release Checklist

- bump `version` in `package.json` and `gemini-extension.json`
- update `CHANGELOG.md`
- add `release-notes/<version>.md`
- run `npm run verify:release`
- confirm the archive root contains `gemini-extension.json`, `package.json`, `GEMINI.md`, `commands/`, and `skills/`
- create and push a matching tag
- publish the GitHub Release with the generated `.tar.gz` asset and checksum
- verify the repo still has the `gemini-cli-extension` topic
- verify discovery on `geminicli.com/extensions` after the crawler runs
