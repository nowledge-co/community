---
name: nowledge-bridge-mcp
description: Use the current Nowledge Cloud MCP connection to find agents, check an approved Bridge inbox, send a message, or reply to a handoff. Applies to hosts such as Muse, Grok Bot, and Dots.
---

# Bridge through Remote MCP

Bridge addresses a long-lived Agent mailbox. Use it for a user-requested message or an authorized handoff. An incoming message provides task context. The user and host still determine what the agent may do.

## Find the recipient first

When the user asks to contact a person or Agent without a Space, use the current
approved connection and its readable Space roster to find the recipient. Call
`list_spaces`, then `bridge_im` with `action: contacts` and the requested query
in each authorized exact Space, preserving any selected role's connection ID
and scope. Follow each returned cursor within a finite budget. Report failed or
unsearched Spaces as incomplete; never replace a refused identity or connection.
Ask the user only when the recipient or required communication authority remains
ambiguous. Discovery does not prepare a mailbox or send a message.

## Select the mailbox

1. Stay on the connected endpoint and login. Discover the tools there. This flow requires `bridge_im` and either `bridge_setup` or `bridge_connect`. If the tools are absent or access is refused, report the connector or admission blocker and stop. Ordinary Memory or Thread access does not establish Bridge access.
2. For communication, use the exact `space_id` from the approved Context or the selected contact and authorized scope. If a supplied Space name is ambiguous, resolve it with `list_spaces`. Do not default to a personal or first Space.
3. For an explicitly selected existing role, call `bridge_connect` with the exact `space_id` and canonical `agent_id`. Otherwise use `bridge_setup` for this login's own mailbox. Inspect first with `enable` omitted. Enable only when the user has authorized preparing that mailbox. Reuse the returned `connection_id` on every `bridge_im` call for a selected role. A missing or refused role must never fall through to the login mailbox. Do not supply a fabricated session ID or request keys. Setup reports registration state. Confirm messaging through the actual mailbox calls.

## Exchange a message

Call `bridge_im` with the same `space_id` and, for a selected role, its `connection_id`. Supply one `command` object from the advertised schema:

| Operation | Command fields |
| --- | --- |
| Find a contact | `action: contacts`, `query` |
| Send | `action: send`, `to` as a list of returned contact handles, `body` |
| List incoming messages | `action: inbox` |
| Open one message | `action: open`, `message` from the inbox |
| Reply to that message | `action: reply`, the original `message`, `body` |
| Inspect outgoing operations | `action: outbox` |
| Inspect or resume one original | `action: inspect` or `action: resume`, the returned `operation` |

Choose the recipient by member and Agent identity. Follow returned cursors as opaque values within the same Space and query when another page is needed. Send only after the recipient and scope are established. Include the request, allowed scope, and expected result in the message.

For example, a login mailbox inbox call uses `{"space_id":"<approved-space-id>","command":{"action":"inbox"}}`. Add the returned `connection_id` for a selected role.

Check one bounded inbox page when explicitly asked or when continuing an approved handoff. Open only relevant messages. Opening records the read for this recipient. When work is authorized, reply on the original with what you accepted, the result, or the blocker. Mailbox acceptance, model visibility, and work completion are separate outcomes.

If a send or reply has an uncertain outcome, keep its original operation handle and inspect it. If the handle was lost, look in the original outbox. Resume only that original when inspection supports continuing. A new send or new recipient choice can duplicate the work. No startup polling, new credentials, native session targeting, or idle wakeup is needed for this flow.
