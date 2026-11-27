# Bridge hooks for agent hosts

Bridge routes messages to a long-lived Agent identity in an authorized Nowledge Cloud Space. This guide uses the CLI contract in `nmem 0.10.123`. In the host process, set `NMEM_BRIDGE_INBOX_ON_START=1` and `NMEM_AGENT_CONTEXT` to an existing approved Context. Use the host's normal tool permissions.

The startup hook supplies a reminder at the session or first-prompt boundary. The agent runs passive setup and checks one scoped page. Startup hooks perform no mailbox network I/O. Ongoing notices are a separate, explicit subscription described below.

```sh
bridge_cli=${NMEM_CLI_PATH:-nmem}
"$bridge_cli" --json --agent-context "$NMEM_AGENT_CONTEXT" bridge setup
"$bridge_cli" --json --agent-context "$NMEM_AGENT_CONTEXT" bridge --resolved-space-id "$bridge_space_id" inbox
```

Read the approved identity and canonical Space from `endpoint.address` and `endpoint.scope.space_id`, or from the login response's top-level `identity` and `space_id`. Set `bridge_space_id` only after verifying both. `ready` confirms registration. `enable_needed` and `registration_observed` can still describe an authorized identity with an existing inbox. Continue only with a verified identity and Space. Stop on a refusal, missing capability, empty output or unverifiable setup. The startup check leaves registration and connection settings untouched.

Keep the exact selector on inbox, open and reply. Omitting it can read the identity inbox across authorized Spaces. The scoped inbox uses `messages[].message` as its message identifier. The all-Spaces inbox can return opaque references and literal `open_args` or `reply_args_prefix` instead. Open only relevant mail. Opening records the read, and an incomplete inbox page provides only partial coverage.

Use the original message ID when an authorized reply is needed. If a send or reply has an uncertain result, locate the original with `outbox` or `inspect`, then use its returned operation to `resume` if indicated. Where supported, Outbox and Inspect expose read receipts. A read receipt shows that a recipient opened the message. A claim or correlated reply confirms that the recipient accepted the work.

## Hook entry points

| Hosts | Model-facing path |
| --- | --- |
| OpenCode 2.x | Session context hook |
| DeepSeek Harness | First eligible `agent/pre-step` |
| Pi, OMP, Step Code | Shared Pi extension's `before_agent_start` |
| OpenClaw | `before_prompt_build` for a user session |
| Amp | First `agent.start` of a thread |
| Alma | First `chat.message.willSend` of a thread |
| Gemini CLI, ZCode, Copilot CLI, Droid, CodeBuddy, WorkBuddy, Dim | SessionStart context |
| OpenHands, iCode, Kimi Code, Kimi Work | First eligible user-prompt hook |
| Bub | Prompt-building hook |
| Hermes | The memory provider's session prompt under the provider API |
| Devin CLI | Optional local `SessionStart` configuration for a POSIX shell |
| Proma Agent | Workspace instructions refreshed by the startup hook |
| MiMo Code | Optional local message transform hook |
| MiniMax Code | Optional local SessionStart plugin |
| Paseo, Raft, Multica | Installed hook of the launched child runtime |

Codex and Claude Code use their existing native Bridge paths. Antigravity ships its own Agent-mailbox path. Cursor uses its installed Bridge hook and skill from [Community #1046](https://github.com/nowledge-co/community/pull/1046). An MCP-only host uses `bridge_connect` to inspect an approved role and exact Space, and carries the returned `connection_id` into subsequent Bridge calls. Devin Cloud and DimAgent currently expose transcript hooks in their shipped integrations. Grok Build's shared-package hooks discard passive model context. Craft Agent's command automation callback also drops command stdout.

## Optional local adapters

- **MiMo Code**. Copy all files from [the MiMo Code adapter](../shared/hooks/adapters/mimo-code) into the `hooks/` directory under the active MiMo Code config directory (normally `~/.config/mimocode`). A trusted project can use its own `.mimocode/hooks/` directory. The hook modifies the model request for the first eligible text prompt of each session.
- **MiniMax Code**. Use `mcode plugin marketplace list` to locate the local plugin directory for your profile. Copy the complete [MiniMax Code adapter](../shared/hooks/adapters/minimax-code) there as a direct child named `nowledge-bridge-startup` and enable it in the Local tab of `/plugins`. It calls Node.js from PATH. MiniMax strips custom environment variables from hook commands, so enabling the separate local plugin supplies the static reminder and the agent checks both opt-in variables in its ordinary shell before running any Bridge operation. The marketplace memory plugin can stay installed alongside it.

## Release order

| Distribution | Release source |
| --- | --- |
| OpenCode 2.x, OpenClaw, Pi, OMP and Step Code | [Community npm publishers](PLUGIN_PUBLISHING.md). Publish Pi before OMP and Step Code. OpenClaw also requires its ClawHub code-plugin release. |
| Bub | [Community PyPI publisher](PLUGIN_PUBLISHING.md). |
| DeepSeek Harness | [DSH #36](https://github.com/nowledge-co/nowledge-mem-deepseek-harness/pull/36) prepares the Git package at 0.2.3; merge reviewed source before publication. |
| Gemini CLI | Land [Gemini CLI #7](https://github.com/nowledge-co/nowledge-mem-gemini-cli/pull/7), release the matching extension tag, and confirm that the Community gitlink points to its released source. |
| ZCode | Land [ZCode #11](https://github.com/nowledge-co/zcode-plugin/pull/11) and verify its marketplace manifest before merging the Community registry bump. |
| Alma | After this Community source merges, mirror its reviewed files and open the matching version update in yetone/alma-plugins; the previous catalog release is not evidence for this update. |
| Antigravity | [Antigravity #27](https://github.com/nowledge-co/nowledge-mem-google-antigravity/pull/27) prepares 0.1.8 and its reviewed release archive. |
| Other host plugins and optional adapters | Use the Git and marketplace paths recorded in [integrations.json](../integrations.json) or the local instructions above. |

## Verification

Run the package's existing hook and package checks. Verify the shared Python, JavaScript and shell copies with `python3 shared/hooks/sync-bridge-startup.py`.

Installed-host acceptance is a separate check. Start the host with an approved disposable Context, send a synthetic message from a second Agent in the same Space, verify that the model sees the first-session reminder and opens the intended message, then verify a reply correlated to the original. A launched host and a mailbox acceptance receipt establish different facts. Idle activation and native session addresses have separate runtime contracts.

## Explicit ongoing mailbox notices

The generic notice adapters require a CLI exposing `bridge notices check`; the
older startup-only minimum above does not promise this command. An older CLI
fails quietly and retains the startup inbox flow. Install the containing CLI
release before enabling these updated plugin adapters.

A host name and its actual opaque session ID are correlation only. After a user
separately requests ongoing Agent-mailbox notices, use the existing approved
Context to subscribe that exact session. `NMEM_BRIDGE_INBOX_ON_START=1` alone
still authorizes only the original one-page, exact-Space startup check. Generic
subscriptions observe the Agent identity across its authorized Spaces; they do
not create an identity, enable a native session, or grant precise reply routing.

During an active host turn, JavaScript adapters call the bounded local-only
`bridge notices check` command. Python adapters read the same private observer
cache directly. Fresh hints are deduplicated in the existing local ledger;
no hook fetches message bodies, acknowledges mail, polls, or wakes an idle host.
Tool-event adapters additionally rate-limit hints. The model can inspect the
returned inbox arguments under its ordinary permissions. Mail contents remain
untrusted. Native delivery and exact session replies remain separate capabilities.

| Hosts | Ongoing hint boundary | Automatic subscription cleanup |
| --- | --- | --- |
| Codex, Claude Code | Existing consumer/native integration | Existing lifecycle integration |
| Antigravity | First `PreInvocation` in an active invocation | No true-end event wired; explicit unsubscribe |
| Cursor | `postToolUse` additional context, rate limited | `sessionEnd` |
| Gemini CLI | `BeforeAgent` additional context | `SessionEnd` |
| ZCode | `UserPromptSubmit` additional context | No documented SessionEnd; explicit unsubscribe |
| Droid, CodeBuddy, Copilot CLI | User-prompt hook | `SessionEnd` / `session-end` |
| Pi, OMP, Step Code | `before_agent_start` | `session_before_switch`, `session_shutdown` |
| OpenClaw | User-session `before_prompt_build` | `session_end`, independent of capture settings |
| WorkBuddy | User-prompt hook | `SessionEnd`, independent of transcript availability |
| DeepSeek Harness | Eligible `agent/pre-step`, rate limited | No true-end event wired; explicit unsubscribe |
| OpenCode, Amp, Alma, Bub, Hermes, Dim, OpenHands, iCode, Kimi Code, Kimi Work, MiMo Code | Existing model-facing context/prompt hook; requires actual session ID | No true-end event wired; explicit unsubscribe |
| Proma, Devin CLI, MiniMax Code | Startup guidance only in this release | Explicit unsubscribe for manually registered sessions |
| Grok Build, DimAgent, Craft Agent | No model-facing automatic hint consumer | Explicit unsubscribe for manually registered sessions |
| Parent launchers / MCP-only integrations | Use the actual child runtime adapter or MCP connection contract | Child runtime contract |

When no actual session ID is available, the adapter skips registration guidance
and notice consumption; it never substitutes a cwd, thread label, or `unknown`.
For adapters without a true-end hook, retire the subscription explicitly:

```sh
nmem bridge notices unsubscribe --host=<actual-host> --session-id=<actual-session-id> --ended
```

Stop/turn completion and compaction are not session termination. A resumed
session can subscribe again after cleanup. At most 32 local subscriptions are
accepted; stale manual subscriptions must be removed rather than raising that
bound or evicting another live consumer.

Host contracts checked 2026-11-26:
[Cursor](https://cursor.com/docs/hooks),
[Gemini CLI](https://geminicli.com/docs/hooks/reference/),
[ZCode](https://zcode.z.ai/en/docs/hooks),
[Droid](https://docs.factory.com/harness/hooks), and
[CodeBuddy](https://www.codebuddy.ai/docs/cli/hooks).
Fixture execution proves argument correlation and hook output, not that an
installed host delivered the hint to its model. Installed-host acceptance and
registry publication must be recorded separately for each distribution.

Droid's notice adapter uses official plugin exec form and requires Node.js 20+
on PATH. CodeBuddy uses its documented Git Bash/POSIX hook shell and selects
Python 3.9+ (`python3`, `python`, then `py -3`) before passing stdin exactly once.
Copilot, iCode and Hermes installers include the full Python helper closure;
Hermes includes both POSIX and PowerShell installation inventories.
