# MiniMax Marketplace Submission

This file is the owner handoff for the MiniMax Marketplace form. It is not a runtime instruction and contains no credentials.

## Package

- Plugin name: `nowledge-mem`
- Package version: `0.1.2`
- Source: `https://github.com/nowledge-co/community/tree/main/nowledge-mem-minimax-plugin`
- Manifest: `.minimax-plugin/plugin.json`
- Operation: `Update` after the initial `PLUGIN-202609040138` validation failure.

## Requested catalog placement

- Target regions: `CN` and `US`
- Delivery targets: `Desktop` and `Cloud`
- Organization: `Nowledge Labs`
- Contact: use the owner's current Nowledge Labs submission address at form time; do not commit it here.

The package is mechanically ready for Desktop. The Cloud target is intentionally requested as a coordinated App/Connector rollout, not as an MCP-only fallback. MiniMax must confirm the provider/app integration and its authorization contract before the Cloud catalog entry is enabled.

## Form

Submit through the official MiniMax form:

`https://vrfi1sk8a0.feishu.cn/share/base/form/shrcnbnpeor3z72fUkeHzrOE7vb`

Use the exact package name from `.minimax-plugin/plugin.json`. For the GitHub source, select the repository and provide the `main` ref plus the `nowledge-mem-minimax-plugin` subdirectory if the form requests a subdirectory.

## Review checklist

- [x] `.minimax-plugin/plugin.json` is at the selected package root.
- [x] The package contains Skill and Streamable HTTP MCP capabilities.
- [x] The MCP endpoint is local-only and contains no credentials.
- [x] The package contains no install script, executable, symlink, native binary, secret, or personal data.
- [x] The Skill does not claim automatic transcript capture or lifecycle hooks.
- [x] Cloud App/Connector is called out as a separate MiniMax-owned integration gate.
- [ ] MiniMax confirms the Cloud provider/app identifier and authorization scopes.
- [ ] Owner submits the form and retains the submission ID.
- [ ] Owner checks the submission status using the original Feishu account and submission email.

## After MiniMax confirms the App

1. Add the exact provider reference and approved scopes to the Marketplace catalog entry or the provider-owned integration configuration, according to MiniMax's instructions.
2. Keep `apps` in this package aligned with the schema MiniMax confirms. Do not invent an App object locally.
3. Re-run package validation and publish a new package version before requesting an update review.
