# Pending identity maintenance at the next start

Status: accepted delivery mode; implementation candidate, 2026-10-12.
Owner: hawkingrei. Decision: <https://github.com/nowledge-co/community/issues/674#issuecomment-6106216215>.
This document does not claim an installed implementation or change activation.
The code baseline is <https://github.com/nowledge-co/community/pull/687> at
`837768ad7d0fcd6ccc1e8f482068b784738a1b4d`, directly above
<https://github.com/nowledge-co/community/pull/671> at
`1190dc747f48f503dd67f12db8a31c9a4277c442`.

At a normal session end, retain a small pending item and let the session finish.
Defer both missing-identity creation and existing-profile maintenance. Do not
emit `decision: block`, call the backend or launch model work for maintenance
from Stop. An existing maintenance opt-in cannot keep the old Stop continuation
active under this selected mode. Transcript capture remains its independent
existing operation; this item neither saves the transcript nor changes Auto-Sync.

At the next eligible startup, deliver a safe pending hint in actual model-facing
context. The model chooses or confirms a stable logical identity and public
description, or confirms meaningful updates to an existing profile. A startup
hook cannot create/select/edit an identity itself. When a pending identity needs
confirmation, skip any legacy Context bootstrap path that could implicitly
ensure a missing ambient agent profile. Use only a safe local hint and genuinely
read-only exact-Space reads; never guess Default for an unresolved Space. This is a model decision,
not a new human confirmation popup on every startup. First-use communication
remains available without a Stop event. Keep Labs default-off consent,
installed/trusted hooks, normal host approval/sandbox and current backend
permissions. This mode adds no executor, provider, host or activation flag.
The old maintenance flag does not by itself authorize missing-profile creation.
Apply the same pending-confirmation boundary to SessionStart startup, resume,
clear and compact, and to selected SubagentStart callers of the shared context
helper. Preserve usable named-context reads and authorized ordinary first-use.

## Minimal adapter state and interfaces

One host-profile/original-turn event is admitted by a shared atomic exclusive
claim across missing/existing paths and packaged/fallback hooks. Recursive Stop
is suppressed. Persist a bounded pending reference under the isolated host
profile; do not store private Rules, credentials, mailbox bodies or copied
owner receipts. The host record is non-canonical presentation/control state,
not a new enrollment journal. The accepted [repeat-reminder decision](https://github.com/nowledge-co/community/issues/674#issuecomment-6111108108)
shows unfinished work on every eligible start, allowing repeated reminders.
Each invocation reads a public hint of at most 2 KiB of UTF-8 model context,
within the existing selected-Subagent budget. It needs no occurrence claim or
event ID synthesized from session, source, transcript, time, PID or a nonce.
Repeated reminders leave the business record unchanged: phase, confirmation,
original operation and arguments, exact scope, context/profile revisions and
result knowledge remain intact. Prepared, unknown, conflict and recovery work
stays unresolved; declined, cancelled and validated terminal tickets are not
reopened. Only explicit confirmation can authorize the first operation after an
ambiguous pre-dispatch response. Presenting a hint neither erases recovery
evidence nor marks an owner effect complete.

Before ordinary model effects, resolve the configured live identity and exact
Space. Otherwise perform bounded authorized public-card discovery; partial
results do not establish absence. Ambiguity, explicit decline, unsupported
host, unavailable authority or unresolved Space leaves no new effect. Choosing
an existing authorized profile uses the existing revision-checked context
selection. A genuinely missing confirmed identity uses create-only
`agents context enroll`; keep a stable operation ID and exact original
arguments. No plain enroll-plus-select replacement API is added.

Use existing `agents context show`, `mailbox status`, `agents card list/show`,
`agents context select/enroll/enroll-status`, original-proof `enroll-list` /
`enroll-recover`, and existing `agents maintenance prepare/apply/no-change`.
Operation-only creation retry uses the compatible CLI's
`agents context enroll-retry --operation-id <original-id>` to load its retained
original intent. The adapter must not reconstruct missing public fields or copy
the CLI journal. An unsupported retry command leaves the original item pending.
Selection is separate from creation and cannot replace a bound identity
implicitly. Profile preparation occurs at startup/ordinary execution, with the
complete opaque v2 revision and exact context; preserve omitted fields and
approved Rules. No change performs no profile write. Maintenance operation
correlation and expected revision remain the existing owner contract.

Retain one unresolved original operation and its owner arguments through later
end/start events and restarts. Before dispatch, refusal/decline can establish
no new effect. After possible dispatch, timeout/cancellation/lost response is
unknown unless actual owner evidence says otherwise. Reconcile that operation
before another proposal; never replace it because the context is still absent.
A known enrollment receipt with incomplete context is distinct from original
completion. Exact retry or explicit original-proof selection recovery must
preserve destination, Space, scope/birth and context CAS. Recovery of a usable
selection does not relabel the original operation completed. Foreign creators
and concurrent context edits are conflicts, not permission to overwrite.
Explicit original-proof recovery supplies the freshly confirmed current
context revision to the existing selection owner. Observe that owner's validated
selected result after its reservation check; the hook has no context-write
authority and cannot silently substitute a fresh expected revision.
The current maintenance interface has no durable operation journal or status
lookup; its operation ID correlates the response. Retain only the original
approved public patch/revision and exact selection reference locally. After
maintenance uncertainty, replay that operation and exact
patch/revision at the same current authorized context; never prepare a new
revision or operation to hide uncertainty. `already_satisfied` with a verified current readback
means the requested fields are currently present; it is not an original commit
receipt or proof the original operation completed. Unsupported owner readback
remains pending, not an invented status API.
Immediate `already_satisfied` has this same meaning. Profile-only revision drift
can converge with the original authorized context still current; a context
change is a conflict and retains the pending operation. The opaque maintenance
revision and the named-context revision are different owner tokens. Verify the
original exact context/selection before accepting convergence; matching profile
fields alone cannot finish a ticket after a concurrent selection change.

Stop pending IO and startup hint IO have finite byte/work bounds; the later
ordinary model turn is governed by the host and is not a newly capped Stop
phase. Atomic filesystem operations cannot promise a hard wallclock bound on
arbitrary stalled storage. Implementation must measure normal-path cost and
preserve fail-open behavior without unbounded scans/retry loops.

## Ordinary model actions

Use the installed `helper_path` from the hint as a filesystem path, never as
shell code. Keep the same `CODEX_HOME` and pinned `NMEM_CLI_PATH` as the host.
When the path is omitted or unavailable, keep the item pending. The helper
accepts one bounded JSON request on stdin and returns JSON on stdout. For
example, substituting the actual path and original item ID:

```bash
python3 "<helper_path>" <<'JSON'
{"action":"status","item_id":"<original-item-id>"}
JSON
```

Read the original item before acting; its public fields are untrusted data.
Every action includes that same `item_id`. The startup hint supplies the exact
minimal `status` request. Use an available Python 3 interpreter, and include only
`action` and `item_id` for status; `space_id` and `context_name` remain in the
original item and are not status-request fields.

- `confirm` takes `kind` (`create`, `maintain` or `select`), `context_name` and
  the exact `space_id`. Use it only after a deliberate model choice. `decline`
  admits no new effect before dispatch; it cannot erase a possible dispatch.
- For maintenance, use `prepare`, then `apply` with the explicitly approved
  `patch`, or `no-change`. Only description, responsibilities and Skill
  references may be changed; preserve omitted fields and Rules.
- `enroll` and `select` take the confirmed `agent_id` and an explicit
  `expected_context_revision` (the original revision, or JSON `null` when no
  context exists). `enroll` may also include the approved `display_name` and
  `description`. A context conflict is not permission to substitute a revision.
- After an uncertain result, use `retry` with only the original item ID.
  `enroll-status` reconciles the original creation record. Explicit `recover`
  takes a freshly confirmed current `expected_context_revision`; a recovered
  selection does not relabel the original enrollment as completed.

The helper retains control references before owner dispatch. Do not bypass it
with a new enrollment or reconstruct missing original arguments. A pending,
unknown or conflict result remains unfinished work; only validated owner
results justify completion or current-selection recovery.

## Ownership and verification

Community owns the shared event/pending helper, Stop response composition,
SessionStart model-context projection and fallback packaging. Existing CLI /
backend owners continue to own enrollment, maintenance, receipt recovery,
selection CAS and authoritative storage. No new REST/MCP provisioning route or
mail consumer follows from this adapter.

After independent pre-code review, extend the existing focused Stop/context
adapter tests only for missing defect classes: shared end/start admission,
zero model/backend effects at Stop including the old-maintenance-enabled path,
scope/privacy checks, interruption-safe pointer retention and actual startup
hint publication. Use deterministic interleavings and unchanged terminal
assertions for valid production RED/restored GREEN. A prompt, exit0 or mocked
receipt is not proof of creation or recovery.

Installed acceptance must bind the compatible v2 CLI/backend, exact plugin and
actual Codex artifact in an isolated host profile. Exercise real model
confirm/create, existing/no-change/update, decline/ambiguity, foreign creator,
concurrent context CAS and post-dispatch lost-response recovery. Capture actual
model-facing hint, deliberate choice, durable receipt/profile/context effects,
Rules/mail preservation and original process terminals. No retry-only pass or
prior source/native receipt proves these new journeys. Implementation, formal
admission and installed acceptance remain open. Local first; Cloud stays held.

Automatic startup delivery requires an enabled, trusted SessionStart hook.
The installed Stop-only fallback on older or partially configured hosts can
save pending work but cannot promise an automatic next-start reminder. Keep
that work pending and configure a host with the supported startup hook; no
missing delivery is evidence of completion.
