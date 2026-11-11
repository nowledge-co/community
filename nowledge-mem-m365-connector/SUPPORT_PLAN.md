# Microsoft 365 support delivery contract

This plan distinguishes implementation, protocol validation, tenant acceptance
and public distribution. None substitutes for the next. Owner: Nowledge
maintainers; customer request [#349](https://github.com/nowledge-co/community/issues/349).

| Workstream | Deliverable / acceptance | Current state |
|---|---|---|
| Studio direct MCP | Guided tool setup, scoped agent instructions, importable Swagger wrapper, explicit end-user connection | Implemented; native tenant test outstanding |
| App remote access | Permanent Nowledge Link or custom Access Anywhere HTTPS, direct bearer header connection | Kit implemented; no OAuth or relay added; native tenant test outstanding |
| Cloud direct API key | Same direct header contract using a separately authorized Cloud connection | Candidate route; maker/user isolation must pass in target channel |
| Cloud OAuth | Per-client secret-bearing DCR plus PKCE, unchanged public-client mode, all token/revoke gates | Confirmed compatibility gap; separate backend implementation and release required |
| M365 app distribution | Complete v1.30 agentConnectors app manifest and ZIP with tenant-owned IDs/icons/auth references | Implemented generator; Microsoft validation and tenant install outstanding |
| Cowork | Authorized static tools/list snapshot and package, actual host schema limits and tool refresh | Not claimed by dynamic package; separate acceptance |
| Declarative OAuth agent | Toolkit lifecycle including extendToM365, OAuthPluginVault and approved tool surface | After confidential-client OAuth is available; not interchangeable with agentConnectors |
| Gallery | Partner submission, publisher/privacy/support materials, Microsoft approval | Separate from private tenant sideload; not submitted |
| Original conversations | Stable source IDs, complete native originals, bounded incremental acknowledgement | No verified host export/lifecycle; do not advertise auto-capture |

## Backend authentication scope

We do not need a new identity provider, Microsoft-to-Mem account merger, shared
secret or App proxy. A client secret authenticates a **client**, not a person,
workspace or Space. Per-user Mem sign-in/consent and current membership remain
the source of data permissions. Microsoft work login alone grants no Mem access.

The necessary OAuth extension must negotiate each client's method explicitly,
store only secret hashes, preserve existing default `none` registrations and
require client authentication before consuming a code, rotating a refresh token
or revoking credentials. Keep S256 PKCE, issuer, redirect, resource and scope
binding. A wrong secret must not consume a valid grant or revoke another client.
Test code retry, refresh replay/family invalidation, revocation, expiry and
public-client regression on both App and Cloud. Deploy Cloud DDL and code through
the normal operator-owned release procedure, not a marketplace setup script.

## Native acceptance packet (requires a Microsoft tenant)

Record the exact Microsoft product/channel, tenant policy and auth model.
Use two test users, two authorized Spaces and synthetic markers. First prove
initialize/tool discovery and a targeted read. Then explicitly authorize a write,
read its marker back, and approve cleanup. Repeat read-only write refusal,
wrong-Space refusal, refresh and revocation. Published users must authenticate
independently: an owner/maker connection silently reused for a second user fails
acceptance. Studio test-pane success does not prove the Microsoft 365 channel.

For DCR record sanitized request metadata, negotiated auth method and response
field names, not secret values. Prove RFC8707 resource propagation on token and
refresh; do not remove the resource check if Microsoft omits it. Test unavailable
App and expired/invalid credentials produce explicit failures. Retain only
redacted evidence; no personal memories or company content in fixtures.

## Completion rule

No tenant is currently available to the owner. Offline packaging/schema and
synthetic tests can be finished now; tenant installation, Microsoft's token-store
behavior and Gallery approval cannot be manufactured by more local tests.
Keep #349 open until the selected supported path has real published-host
acceptance. Publish only the matching capability claims, and keep other routes
explicitly unavailable or experimental until their own gate passes.
