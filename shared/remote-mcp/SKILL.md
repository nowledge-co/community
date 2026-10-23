---
name: remote-mcp
description: Use connected Nowledge Mem tools in a hosted AI client and set up daily original-conversation sync to Threads when the host has message access and a scheduler.
---

# Remote MCP: use and daily Thread sync

Use this shared procedure for Dots, Grok Bot, Meta Muse, and other hosted clients.
Muse Desktop OAuth, tool discovery, synthetic Thread save, exact replay and
original readback passed real-account acceptance on 2026-10-23. This does not
prove access to personal transcript history, stable host IDs, Cloud runtime,
or unattended daily execution. Check each capability for the current account.

## Connect and choose a destination

1. Read https://mem.nowledge.co/SKILL.md for the current host setup path. Reuse an
   existing connection. Ask before replacing a connection or changing its target.
2. Choose Nowledge Cloud or the user's App. Cloud uses its workspace MCP URL.
   App uses its public HTTPS Access Anywhere URL. Hosted clients cannot reach
   localhost or private LAN addresses. App traffic goes directly to that endpoint.
3. Complete the host's OAuth flow. Never ask for keys or tokens in chat. Request
   `threads:sync` for original-message storage and `threads:read` for readback;
   `mem:write` is separate. An old read-only grant needs new consent, not just a
   token refresh. Do not treat obsolete `threads:write` as synchronization access.
4. Inspect the connected tool catalog. Use the exposed names; hosts may add a
   prefix. If `sync_thread` is missing, explain the version, profile, or permission
   gap. Do not bypass it with native Thread creation tools or Memory writes.
5. Read Context Bundle to resolve context and scope only if exposed in the tool
   catalog; otherwise report it unavailable and continue with the confirmed scope. Reuse the user's confirmed exact
   target Space; ask before the first write only if no destination is confirmed. A source label or client name is not an
   AI Identity or a Space selector. Preserve existing conversation ownership.

## Muse setup

The verified path creates a custom MCP client in Muse's private workspace through
chat. A native Remote MCP settings menu or official connector listing has not
been verified. This is guided custom-client setup, not a native plugin install.
Inspect the actual catalog before context/search calls; report missing tools as
unavailable. Tool discovery is not a successful context/search receipt.

1. In App, choose **Connectors → AI Tools → Meta Muse → Guided setup**. Complete
   owner pairing in the browser that will open the OAuth consent. Keep Access
   Anywhere running. Choose **Open Muse** and paste the copied setup prompt.
   In Cloud, use **Open Muse** in the Cloud OAuth configuration; no Desktop
   pairing is needed. Preserve the Cloud endpoint's `space_protocol=exact-v1`.
2. Reuse an existing connection. Otherwise use Muse's custom MCP client and
   `credentials.request_api_access` to display a real OAuth connect action.
   Read the MCP `WWW-Authenticate` challenge and public resource metadata,
   then `/.well-known/oauth-authorization-server` on the selected origin.
   Use returned issuer, resource, registration, authorization and token values.
   Do not invent a client secret or registration result. The verified App path
   uses public DCR, PKCE S256 and token authentication `none`.
3. Request only `mem:read threads:read threads:sync offline_access` for the
   context and Thread workflow. Ask for separate permission for Memory writes.
   Complete the displayed OAuth action. Opening Muse or saving credentials
   alone does not prove a working MCP call.
4. A custom client must declare a truthful application User-Agent, for example
   `NowledgeMem-Muse/1.0`. The tested default `Python-urllib/3.12` was rejected
   by the development domain with Cloudflare 1010 before MCP initialization.
   Inspect the actual response before assigning a cause. Do not impersonate
   a browser, disable security controls or assume every 403 is an OAuth error.
5. Execute `initialize`, `notifications/initialized`, `tools/list` and each
   tool call as separate steps. Wait for each external-request approval, with
   up to 240 seconds per request. Save the actual receipt before the next step.
   Do not restart a whole multi-request script after an approval timeout.
   Start an already authorized request instead of asking the user to authorize
   the same intent again. Only describe an approval card as pending when the
   host actually displays one. One-request approval remains the default; do not
   request broader permanent permission to make a test pass. Report the actual
   host-provided permission scope, which may be wider than the endpoint.
   If no `Mcp-Session-Id` is returned, do not invent one. Check write status
   before explicit replay of the same snapshot. Do not require permanent
   permission for all domain subdomains to complete a one-time test.
6. After choosing the exact Space, ask to use a synthetic snapshot for the
   first save/replay/readback check. Use `sync_thread` and
   `thread_fetch_messages` from the actual catalog. Verify first additions,
   zero additions on exact replay and the original roles/content. Then apply
   the shared daily execution procedure below to authorized real conversations.

## Load and retain this procedure

Fetch the full skill and check that the response is this document, not an error
page. Save it with the host's supported skill mechanism. If the host has no skill
installer, retain the full procedure in its private connector documentation and
make the connector and daily task read it. Do not claim a skill was installed
when only a URL or a temporary test script was saved. Report the source URL,
version or content digest, saved location and how later runs load it. If the URL
is unavailable, use a user-provided reviewed copy or report the delivery gap;
do not guess its contents. Retain connection and sync state in the host's private
workspace; credentials belong only in its credential store.

## Defaults: do not repeat answered questions

- “Sync this conversation” means the current host conversation. Reuse the
  connection and the exact target Space already confirmed by the user. Ask about
  the destination only if none is confirmed or the requested destination changes.
- Keep one Thread per conversation. Reuse the saved mapping first. Otherwise use
  the host's stable conversation ID with a provider prefix, for example
  `meta-muse:<conversation-id>`. Before creating it, check the exact Thread ID
  with the exposed read tool. Reuse only an identity whose source and Space match.
  A title match alone does not establish conversation identity. Never merge a
  synthetic test Thread into a real conversation.
- Choose the title from the host's conversation title; otherwise use a short
  description of the first user request. Do not ask the user to invent IDs or
  titles. Use provider message IDs when available. Client-generated IDs are
  allowed only with a durable mapping to the same original conversation and
  message occurrences, retained across runs. Do not invent provider IDs or
  recalculate IDs from changing array positions. If durable identity cannot be
  retained, report that limit instead of creating duplicate Threads.
- Preserve all accessible, exportable original messages and roles, including
  visible system, developer and tool messages when provided by the host. Exclude
  credentials and hidden internal instructions. Report inaccessible originals;
  never reconstruct them from a summary.
- Store the skill version, connection reference, confirmed Space, conversation
  and message mappings, actual Thread ID, last successful receipt and task ID.
  Reuse these values on later runs. Never request these technical choices again
  merely because a new day or run has started.

## Read and write knowledge

- Read Context Bundle at startup when identity, Space, or current work matters,
  only if exposed in the tool catalog. Use Working Memory for a lighter briefing
  only when available. Otherwise report unavailable and continue the confirmed
  Thread workflow.
- Search before answering questions about earlier work or decisions only when
  the matching search tool is exposed. Fetch exact Memories or Thread messages
  when supported and needed for evidence; otherwise report the capability gap.
- Store conversation originals in **Threads**. A summary is not an original
  conversation. Distilling a durable claim into a **Memory** is a separate action
  with its own permission; do not do it automatically on every synchronization.

## Set up daily execution

Default to **once a day**, in the user's timezone, for the current conversation
unless the user selected a wider scope. Reuse the host's existing timezone and
schedule defaults, or an already confirmed time. State the chosen time and which
conversations to include. Ask only for a missing timezone or execution time when
the host has no usable default; do not repeat answered questions. Reuse or update an existing matching host task so this
setup does not create duplicate schedules. The task must use the same connection,
authorized target Space, and this procedure; it must be able to call MCP tools
and access the selected conversations when it runs without an active chat.

Use the host's supported scheduler. Report daily sync as enabled only after the
host confirms a real task and its timezone, next run, and conversation scope.
A prompt, skill installation, OAuth connection, or Mem-side timer is not a host
schedule and cannot grant access to private host history.

If original messages, stable IDs, background MCP calls, or scheduling are missing,
report **daily sync is not enabled** and name the missing capability. Offer an
explicit sync of accessible originals or the host's supported export path. Do not
claim that a reminder can read all chats. Keep the task quiet when no information
changed; report failures or required user action through the host's task status.

## Execute each synchronization

1. Read the host's actual original messages. Keep stable source, conversation,
   and message IDs, exact roles/content, chronological order, and available
   original timestamps. Use one Thread per host conversation across daily runs.
   Never invent original IDs from a changing array position, generate text from
   memory, or claim unseen history was included. If stable IDs cannot be recovered,
   stop and explain rather than creating a new Thread on every run.
2. Call `sync_thread` with `thread_id`, `source`, ordered `messages`, and the exact
   `space_id`. Use the existing provider identity when continuing an imported
   Thread; do not guess a new source name to evade a conflict.
3. When adding messages, send the full ordered snapshot including every saved
   message. This API does not accept a new-message-only tail. Preserve prior
   content and order; include missing earlier messages when the host finds them.
4. Respect the current limits: 5,000 messages, 256 KiB per message, and 8 MiB total
   original UTF-8 content. A deployment may impose a lower limit. If exceeded,
   report the limit and use a supported export/import path. Do not silently
   truncate, split a growing snapshot into independent chunks, or create daily
   duplicate Threads to evade the limit.
5. Advance the saved checkpoint only after `snapshot_saved: true`. Keep the
   receipt's actual `thread_id` and `space_id`. On an uncertain result, retry the
   same snapshot with the same IDs and Space. Exact replay adds zero messages.
   Do not move an existing Thread to a different Space by changing the request.
6. Verify the first save by exact-ID readback when permitted. Report submitted,
   added, and stored message counts, the saved Thread identity, and any inaccessible
   history. A receipt proves only the submitted originals. Skip unchanged
   conversations after a confirmed save; failures must remain eligible for retry.

## Completion report

Report connection, read access, Thread write access, original-message coverage,
and scheduling separately. Do not label a partial snapshot as a complete history
or a successful manual call as an active daily task. Keep credentials and private
message content out of status reports.
