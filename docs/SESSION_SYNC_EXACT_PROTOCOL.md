# Session sync and the exact Space protocol

Direct REST producers must send `X-Nmem-Space-Protocol: exact-v1` on
create/import, append, checkpoint reconciliation, and associated reads.
Declaring it on the MCP connection or sending regular tools through a current
CLI does not cover a plugin's separate HTTP transcript connection.

Configured Space names/aliases must resolve through the same destination's
authenticated `/spaces` roster without an inherited Space selector. IDs win
over display names; unknown or ambiguous references stop the write. Never
slugify, create a Space, or retry without the selector. Resolve before sending
conversation content. An omitted selector stays omitted for backend-owned
placement. An explicit per-call `space_id` is an exact ID, not an alias lookup.
Preserve opaque UTF-8 IDs in JSON/query values; MCP header selectors use
`X-Nmem-Space-Id-Encoded: percent-v1:<percent-encoded ID>` rather than the legacy
raw-ID header. This declaration does not grant authorization.

## Audited producers (2026-11-12)

| Producer | Transport and delivery |
| --- | --- |
| Hermes | Direct import/append; Git installer; 0.5.28 |
| OpenClaw | REST create/append/read; npm + ClawHub; 0.8.43 |
| Pi | Live and historical REST create/append; npm; 0.8.18 |
| OMP / Step Code | Pi runtime wrappers; npm; 0.1.6 / 0.1.4 |
| OpenCode | REST create/append and explicit save; npm; 0.4.9 |
| Amp | REST create/append; Git install; 0.1.9 |
| Alma | REST create/append/read; folder + external marketplace; 0.7.12 |
| OpenHands | REST import/recovery; Git install; 0.1.3 |
| Proma | REST create/append; Git install; 0.1.8 |
| LangGraph | Sync/async REST import and MCP headers; PyPI; 0.1.3 |
| Pydantic AI | REST import and MCP headers; source distribution; 0.1.1 |
| Codex, Claude Code, Kimi, Dim, Cherry Studio, Bub | Transcript upload uses the CLI; no separate direct-HTTP capture factory found |

Raycast's HTTP client is a memory-tool surface, not a session synchronization
producer. Its wider REST compatibility is outside this transcript fix.

## Destination boundary

Configure the final App or Cloud API address. Authenticated transcript and
Space-roster requests refuse HTTP redirects, so neither custom API-key headers
nor conversation bodies are forwarded to a different destination. A redirect
is a failed synchronization, never a persistence acknowledgement. Correct the
configured address rather than retrying without its credentials or Space.
LangGraph enforces this per request even for injected HTTP clients; Pydantic AI
already does so. CLI-owned transports retain their own independent contract.

OpenClaw retains its normal Context Bundle/Working Memory bootstrap, but labels
persisted context as reference data rather than instructions or permission to
act. It does not disable intended startup context to satisfy a scanner hint.

## Release acceptance

The shared TypeScript core is embedded: update and test all five consumers and
Pi's two wrappers together. Run the focused tests, protocol-enforcing HTTP
fixtures, registry contracts and artifact freshness checks. Follow
`docs/PLUGIN_PUBLISHING.md`: source merge is not npm/PyPI/ClawHub publication;
each channel needs its own CI receipt after a reviewed merge. Mirror Alma to
the external marketplace only from the merged community source. Hermes needs
the plugin update/reinstall, not a new Mem application release.

These tests establish the missing-acknowledgement failure and its correction;
they do not prove this was the only cause of the original user's report.
