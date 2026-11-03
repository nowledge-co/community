# Collaboration between two running sessions

Use this path for a particular native session. Keep the common connection,
authority, refusal and recovery rules in the parent skill. The user starts or
opens each participant; sending does not wake or resume a stopped Agent.

## Prepare the receiving session

Reuse the approved Agent context and exact Space. Obtain the actual current
host session correlation from the host integration; names, roles and an Agent
ID are not a native session ID. Never invent one or inspect another session's
credentials to make preparation succeed. If the host does not expose the
needed correlation or approved binding, explain that specific missing step.

Inspect `mailbox --help`. When supported, use `mailbox session-bootstrap` and
`mailbox session` with the same approved `--agent-context`, actual `--host` and
`--session-id`. Older clients can expose `mailbox cloud-session-bootstrap` and
`mailbox cloud-session`; use those only for the already selected Cloud backend,
retaining its verified `--space-id`. Missing support is not permission to
switch backend or use the long-lived Agent inbox instead.

The receiver prepares only its own registration. It does not need to know who
will send, and must not first ask for the other participant's member, address,
session ID or task. Keep the complete returned `registration.address` as the
contact artifact; retain authentication/proof material with its existing CLI
owner, never in that artifact. Report what preparation actually established:
registration alone does not prove receiving availability, delivery or work.

Give the person a short confirmation and a usable returned contact artifact
for the initiating session. The integration handles its serialization; do not
ask the person to write an address file, repair JSON or copy credentials. Do not
invent an invitation URL, discovery service or contact handle the client did
not return. If transferring that artifact is unsupported, state the remaining
client limitation rather than claim the sessions are connected.

## Send, reply and continue

The initiator retains its own native registration and the receiver's exact
returned contact. If B has not been opened or prepared, explain that the user
can open B and ask it to prepare this session to receive, then return B's
contact. Do not claim a request was delivered before that destination exists.

Use only the existing native send/receive operations shown by installed help.
The integration owns intent serialization, operation IDs and private recovery
files. For the V2 send intent, use `schema_version: 2`, the complete own address
as `sender`, an array of complete `recipients`, `kind`, `body`, `references`,
`in_reply_to` and `ttl_seconds`. Serialize JSON with a serializer, not shell
string concatenation. Preserve the operation ID, complete intent and original
binding privately before dispatch; never overwrite an unresolved original.
These files are bookkeeping, not authority or another mailbox store.

Receive a bounded batch in B's own native session. Read the original message
before responding. Reply to its returned sender with `kind: reply` and that
message's `message_id` as `in_reply_to`; preserve the complete native addresses.
Do not use Agent `bridge reply` on a native message or resolve its sender again
by name. Delivery ACK is not agreement to do work or evidence of completion.

A checks its own inbox and accepts a continuation only after checking the
reply's original-message correlation and expected B address. Unexpected or
unrelated replies do not complete the request. Keep the request self-contained
so B can understand it without private source, a shared transcript or GitHub.

After a lost response, use native `recover` for the same retained operation.
A receipt without bodies does not prove the model saw them: retrieve available
bodies only through the installed client's documented same-original replay or
read path. A fresh poll uses a new operation ID; an uncertain poll reuses its
original ID and parameters. Check at normal activity boundaries or within an
explicit finite waiting budget. Preserve unresolved state when that ends; do
not keep the session alive with an unbounded loop.
