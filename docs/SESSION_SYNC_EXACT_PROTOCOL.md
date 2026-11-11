# Session sync and the exact Space protocol

Direct REST producers must send `X-Nmem-Space-Protocol: exact-v1` on
create/import, append, checkpoint reconciliation, and associated reads.
Declaring it on the MCP connection or sending regular tools through a current
CLI does not cover a plugin's separate HTTP transcript connection.

Configured Space names/aliases must resolve through the same destination's
authenticated `/spaces` roster (Hermes uses `nmem --json spaces list`). IDs win
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
| Hermes | Direct import/append; Git installer; 0.5.26 |
| OpenClaw | REST create/append/read; npm + ClawHub; 0.8.41 |
| Pi | Live and historical REST create/append; npm; 0.8.17 |
| OMP / Step Code | Pi runtime wrappers; npm; 0.1.5 / 0.1.3 |
| OpenCode | REST create/append and explicit save; npm; 0.4.8 |
| Amp | REST create/append; Git install; 0.1.8 |
| Alma | REST create/append/read; folder + external marketplace; 0.7.11 |
| OpenHands | REST import/recovery; Git install; 0.1.2 |
| Proma | REST create/append; Git install; 0.1.6 |
| LangGraph | Sync/async REST import and MCP headers; PyPI; 0.1.2 |
| Pydantic AI | REST import and MCP headers; source distribution; 0.1.1 |
| Codex, Claude Code, Kimi, Dim, Cherry Studio, Bub | Transcript upload uses the CLI; no separate direct-HTTP capture factory found |

Raycast's HTTP client is a memory-tool surface, not a session synchronization
producer. Its wider REST compatibility is outside this transcript fix.

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
