# Nowledge Mem for Microsoft 365 Copilot

Version 0.1.0 — integration kit, **awaiting real tenant acceptance**, not a
Microsoft-approved Gallery listing. Ref [#349](https://github.com/nowledge-co/community/issues/349).

Use Mem from a work/school Copilot agent without copying your knowledge into a
Microsoft Graph search index. Calls go directly from Microsoft to your chosen
Mem endpoint; no Nowledge gateway relays App traffic. This is distinct from
consumer Copilot, GitHub Copilot CLI and the VS Code conversation importer.

## Start with Copilot Studio

You need permission to create/use a Copilot Studio agent and publish it to your
intended Microsoft 365 channel. Your tenant administrator controls availability,
data policies and distribution; a personal Microsoft account alone does not
establish eligibility. Check the tenant's actual licensing rather than buying
a plan based on this guide.

1. Choose your Mem workspace and its **permanent public HTTPS MCP address**.
   For Nowledge Cloud, use `https://cloud.nowledge.co/mcp?space_protocol=exact-v1`.
   For Mem in the App, use the complete address from Nowledge Link or your own
   Access Anywhere domain, with `/mcp?space_protocol=exact-v1`. Keep the App
   running. Microsoft cannot reach `127.0.0.1`; temporary Quick tunnels are not
   a durable setup. Cloud and App remain direct, separate destinations.
2. In Copilot Studio: **Tools → Add a tool → New tool → Model Context Protocol**.
   Name it **Nowledge Mem**, describe it as “Recall decisions and deliberately
   save useful knowledge in my selected Mem workspace”, and enter that URL.
   Use Streamable HTTP, not legacy SSE.
3. **Cloud OAuth is currently blocked for Microsoft's documented DCR flow.**
   Microsoft requires secret-bearing client registration; production discovery
   checked 2026-11-11 advertises only `none`. Existing public-client PKCE works
   for other hosts but is not proof of compatibility here. Do not create fake
   client secrets or switch to anonymous auth. Use the API-key candidate route
   if your chosen workspace supports it, or wait for the OAuth compatibility
   release and actual tenant verification.
   **App or an authorized Cloud API-key connection:** choose **API key → Header → Authorization** and supply
   `Bearer <your Mem API key>` in the connection's secret field. Do not put a key
   in the URL, agent instructions, manifest or chat. Do not select anonymous auth.
4. Select **Add to agent**. Use the instructions below, test in Studio, then
   publish to the intended Microsoft 365 channel through your admin-approved
   process. An attached tool alone is not a published agent.

Use end-user credentials/connections when sharing the agent. Do not share your
maker/owner connection with coworkers: Microsoft login is not authorization to
your personal Mem or all Team Spaces. Review effective connection sharing and
Power Platform DLP policy before publishing.

## Importable configuration

The wizard is preferred. For Power Apps custom connector import, generate a
Swagger 2.0 JSON document (JSON is a supported OpenAPI serialization):

```sh
python3 nowledge-mem-m365-connector/configure.py \
  --url 'https://your-fixed-domain.example/mcp' > mem-studio.json
```

Import it under **Custom connectors → New custom connector → Import OpenAPI**.
The generated wrapper declares Streamable MCP, `Authorization` header security
and an internal required `space_protocol=exact-v1` query parameter. Enter the
Bearer value only when creating the connection. It is an API-key import route;
use OAuth discovery only after the compatibility gate below is satisfied. No generated file contains credentials
and the generator never contacts the supplied address. URL validation is only
syntactic/public-address screening, not a DNS or reachability proof.

For a Microsoft 365 plugin using app-manifest `agentConnectors`:

```sh
python3 nowledge-mem-m365-connector/configure.py \
  --url 'https://your-fixed-domain.example/mcp' --format agent-connectors \
  --auth-type ApiKeyPluginVault --reference-id '<Microsoft configuration ID>'
```

This emits a **fragment**, not a complete installable app. Register the auth
configuration through Microsoft's tooling for the selected auth model first, merge into your existing
app manifest (1.29+ for dynamic discovery), validate with Microsoft tooling,
and test target-host support. `--auth-type ApiKeyPluginVault` is an alternative
only where that host supports it. Cowork still needs a packaged tool-description
file exported from the **authorized** server's `tools/list`; the fragment does
not claim Cowork readiness. Do not invent tool schemas or package an admin's
broader toolset for ordinary users. Declarative-agent MCP actions use a
different manifest and **do not support API-key auth**; do not paste this
fragment into their plugin manifest.

## Build the full app package

After registering the app and authorization configuration in your Microsoft
tenant, prepare a 192×192 color PNG and a 32×32 transparent white outline PNG.
The generator checks PNG headers/dimensions; a human must review the artwork.
It does not register the app, acquire credentials or grant tenant permissions.

```sh
python3 nowledge-mem-m365-connector/configure.py \
  --url 'https://your-fixed-domain.example/mcp' --format app-manifest \
  --auth-type ApiKeyPluginVault --reference-id '<Microsoft configuration ID>' \
  --app-id '<registered app UUID>' \
  --color-icon color.png --outline-icon outline.png --package nowledge-mem.zip
```

The ZIP contains the complete app manifest (v1.30) and both icons at its root.
Existing output files are never overwritten. Validate it with Microsoft
Developer Portal and upload/distribute through the tenant's supported custom
app/connector flow. Schema-valid packages still require supported host rollout,
user authentication, policy approval and native acceptance. This package is
the `agentConnectors` surface, not a declarative-agent `RemoteMCPServer` action.
Use Studio plus our instructions for the guided-agent path.

For OAuth preparation, save the **public authorization-server metadata** from
the same destination as `oauth-metadata.json` (never a token or client record):

```sh
python3 nowledge-mem-m365-connector/configure.py \
  --url 'https://cloud.nowledge.co/mcp' --format oauth-check --metadata oauth-metadata.json
```

Current Cloud metadata yields `microsoft_dcr_candidate: false`. DCR fragment or
package generation requires `--metadata` and refuses public-client-only
metadata. Even a true result is only a necessary advertised-method check, not
proof that a secret is issued, Microsoft's resource parameter is sent, or a
tenant works. Register DCR with Agents Toolkit/the supported developer skill;
Microsoft's DCR-specific documentation says the Teams Developer Portal does
not yet create that auth config. No shared client secret is a workaround.

See [SUPPORT_PLAN.md](SUPPORT_PLAN.md) for the full delivery and acceptance gates.

## Agent instructions

Copy [instructions.md](instructions.md) into your agent's instructions. Tools
come from the authorized server's discovery response, not hardcoded host aliases.
Read and write are supported by the Mem protocol, but available tools depend on
granted scopes, tenant policy and the target Microsoft experience. A read-only
OAuth grant cannot save memories; request deliberate write consent when the
host supports it, never infer permission from a successful search.

## Acceptance before calling it connected

Use a disposable test Space and synthetic data, not personal or company content:

- Confirm connection workspace, account and exact Space. Discover tools and
  perform a small search. A no-match result is not a failed connection.
- With write consent, save a uniquely marked test memory, read it back in the
  same Space, then explicitly approve its cleanup. Test read-only refusal too.
- Test another Space/account cannot read that marker without permission.
- Reconnect/refresh and revoke; confirm revoked credentials no longer work.
- Repeat from the published Microsoft 365 agent, not only Studio's test pane.
- Confirm the App endpoint stays direct and fails clearly when the App is off.

Record actual host, auth mode, granted tools, timestamp and results in #349.
No tenant test, Gallery submission, automatic full-chat sync, native lifecycle
hooks or complete original-message export is claimed by this kit. A manual
handoff summary is distinct from a full transcript. Researcher is read-only.

## Why this route

Prefer interactive remote MCP first: it can reuse Mem's permissions and expose
deliberate writes. Federated Gallery discovery is a subsequent partner approval
workstream, not unlocked merely by implementing MCP. A synced Graph connector
would replicate content and require its own ACL, deletion and privacy design;
it is intentionally outside this implementation. No Entra-only backend, new
credential broker or changes to existing OAuth clients are required here.

Official references checked 2026-11-11:

- [Studio MCP wizard and custom connector schema](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent)
- [M365 app-manifest MCP configuration](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/configure-plugin-mcp-servers)
- [Authentication models and their different API-key support](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-authentication)
- [DCR requires client-secret issuance](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-authentication-dynamic-client-registration)
- [Federated connectors, administration and Researcher restrictions](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/federated-connectors-overview)
