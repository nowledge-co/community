---
name: remote-mcp
description: Use connected Nowledge Mem tools in a hosted AI client and set up daily original-conversation sync to Threads when the host has message access and a scheduler.
---

# Remote MCP: use and daily Thread sync

Use this shared procedure for Dots, Grok Bot, and other hosted clients. Muse is
pending real-account verification. Do not assume a host supports MCP, OAuth,
original-message access, or scheduled tool calls until each capability is checked.

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
5. Read Context Bundle to resolve context and scope. Confirm the user's exact
   target Space before the first write. A source label or client name is not an
   AI Identity or a Space selector. Preserve existing conversation ownership.

## Read and write knowledge

- Read Context Bundle at startup when identity, Space, or current work matters.
  Use Working Memory for a lighter briefing.
- Search before answering questions about earlier work or decisions. Fetch exact
  Memories or Thread messages when the answer needs the original evidence.
- Store conversation originals in **Threads**. A summary is not an original
  conversation. Distilling a durable claim into a **Memory** is a separate action
  with its own permission; do not do it automatically on every synchronization.

## Set up daily execution

Default to **once a day**, in the user's timezone. Confirm the time and which
conversations to include. Reuse or update an existing matching host task so this
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
