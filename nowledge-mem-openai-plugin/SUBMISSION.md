# OpenAI plugin submission handoff

This file is for the Nowledge Labs owner who submits the public plugin. It is
not an automated release step.

## Before opening the portal

1. Verify the Nowledge Labs developer or business identity in the OpenAI
   Platform and grant the submitter **Apps Management** write access.
2. Confirm that `https://cloud.nowledge.co/mcp` is the production endpoint to
   submit. Do not use a local, staging, Access Anywhere, or per-user URL for a
   universal listing.
3. Confirm the MCP OAuth 2.1 metadata contract at the production resource:
   protected-resource metadata, authorization-server metadata, PKCE `S256`,
   `resource` propagation, issuer identification, and the accepted token
   endpoint authentication methods.
4. Scan the production tools and review every tool annotation. Read and write
   tools must be described honestly; the listing must not imply automatic
   transcript capture.

## Portal

Open the [OpenAI plugin submission portal](https://platform.openai.com/plugins)
and create a **With MCP** submission. The package's listing should use:

- Name: `Nowledge Mem`
- Website: `https://mem.nowledge.co`
- Support: `https://mem.nowledge.co/docs/support`
- Integration guide: `https://mem.nowledge.co/docs/integrations`
- MCP server: `https://cloud.nowledge.co/mcp`
- Surfaces: ChatGPT and Codex
- Category: Productivity

Provide a privacy policy and terms URL accepted by the current Nowledge Mem
website. Use starter prompts that demonstrate recall, explicit saving, and
handoff. Include both successful read and write test cases, plus an
unauthorized or missing-authorization case that proves the server fails
closed.

## Do not claim

- ChatGPT automatic full-thread synchronization
- Codex hook behavior inside ChatGPT
- A universal per-user MCP URL or a local desktop endpoint
- Raft's broker-specific login flow as OpenAI OAuth

The public package is one fixed Cloud integration. Workspace-specific or
self-hosted endpoints belong in private client configuration unless OpenAI
explicitly approves a template submission.
