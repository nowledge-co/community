# OpenAI Universal Plugin Submission

Owner handoff for the public directory shared by ChatGPT and Codex. Do not put credentials, customer data, or a user-specific endpoint into the submission.

## Registered production App

- App ID: `asdk_app_6aa369289c1c81919c64940abad926f0`
- Plugin technical ID: `plugin_asdk_app_6aa369289c1c81919c64940abad926f0`
- MCP endpoint: `https://cloud.nowledge.co/mcp`
- Authentication: OAuth with dynamic client registration
- Requested scopes: `mem:read`, `threads:read`, `library:read`, `mem:write`, `library:write`, `offline_access`

The App was created and installed from a verified Nowledge Labs OpenAI organization on 2026-09-11. A real ChatGPT client completed OAuth against the production endpoint, created a synthetic Memory, and fetched it by ID with the exact title and marker returned. Delete that synthetic Memory after retaining the private review evidence.

## Finalization procedure

1. Deploy the production Nowledge Mem Cloud MCP endpoint and verify its public `/mcp`, protected-resource metadata, authorization-server metadata, OAuth consent, token, refresh, revocation, and scope challenges.
2. In ChatGPT, open **Settings → Apps**, or **Workspace settings → Apps** in a managed workspace. Enable Developer mode there when the current plan requires it; an admin may also need to allow custom Apps.
3. Create a production MCP App for the stable public Cloud `/mcp` endpoint and complete a real member OAuth smoke. Creating this App yields the technical ID; public directory review is a separate submission.
4. Copy the technical ID from the connection URL. It must start with `plugin_asdk_app_`.
5. Run `node scripts/finalize-app-connection.mjs plugin_asdk_app_…` from this package only when registering or deliberately replacing the production App.
6. Review the generated `.app.json` and the new `"apps": "./.app.json"` manifest field. Never substitute a guessed ID.
7. Run both validators from the README and test the installed local package in a fresh ChatGPT conversation and a fresh Codex session.

## Required live evidence

- anonymous MCP request returns a protected-resource challenge
- wrong resource, expired/revoked credential, inactive member, and missing write scope fail closed
- approved context read, memory search, scoped memory write, thread read, and Library read succeed
- refreshing rotates the refresh token; replay invalidates its grant family
- no ChatGPT or Codex transcript-capture claim appears in the installed package

## Public submission

Use the OpenAI Plugins Directory submission flow with Nowledge Labs publisher details, product/support/privacy URLs, reviewer instructions, and the live evidence above. Submit the production MCP server and bundled skill together; `.app.json` already contains the real registered development ID for local validation, but the portal must scan the production MCP URL directly rather than importing that existing integration reference. Provide a dedicated reviewer account that can complete every test without MFA, SMS, email confirmation, or private-network access; never reuse an owner or customer account.

The owner must retain the submission ID and review correspondence. Publication in a private workspace or local marketplace is not publication in the universal public directory.
