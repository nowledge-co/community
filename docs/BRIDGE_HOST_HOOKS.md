# Bridge hooks for agent hosts

Bridge routes messages to a long-lived Agent identity in an authorized Nowledge Cloud Space. This guide uses the CLI contract in `nmem 0.10.123`. In the host process, set `NMEM_BRIDGE_INBOX_ON_START=1` and `NMEM_AGENT_CONTEXT` to an existing approved Context. Use the host's normal tool permissions.

The hook supplies a reminder at the session or first-prompt boundary. The agent runs passive setup and checks one scoped page. The hook performs no Bridge I/O.

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

- **MiMo Code**. Copy both files from [the MiMo Code adapter](../shared/hooks/adapters/mimo-code) into the `hooks/` directory under the active MiMo Code config directory (normally `~/.config/mimocode`). A trusted project can use its own `.mimocode/hooks/` directory. The hook modifies the model request for the first eligible text prompt of each session.
- **MiniMax Code**. Use `mcode plugin marketplace list` to locate the local plugin directory for your profile. Copy the complete [MiniMax Code adapter](../shared/hooks/adapters/minimax-code) there as a direct child named `nowledge-bridge-startup` and enable it in the Local tab of `/plugins`. It calls Node.js from PATH. MiniMax strips custom environment variables from hook commands, so enabling the separate local plugin supplies the static reminder and the agent checks both opt-in variables in its ordinary shell before running any Bridge operation. The marketplace memory plugin can stay installed alongside it.

## Release order

| Distribution | Release source |
| --- | --- |
| OpenCode 2.x, OpenClaw, Pi, OMP and Step Code | [Community npm publishers](PLUGIN_PUBLISHING.md). Publish Pi before OMP and Step Code. OpenClaw also requires its ClawHub code-plugin release. |
| Bub | [Community PyPI publisher](PLUGIN_PUBLISHING.md). |
| DeepSeek Harness | [DSH #32](https://github.com/nowledge-co/nowledge-mem-deepseek-harness/pull/32) supplies the reviewed Git package at 0.2.2. |
| Gemini CLI | Land [Gemini CLI #6](https://github.com/nowledge-co/nowledge-mem-gemini-cli/pull/6), release the matching extension tag, and confirm that the Community gitlink points to its released source. |
| ZCode | Land [ZCode #9](https://github.com/nowledge-co/zcode-plugin/pull/9) and verify its marketplace manifest before merging the Community registry bump. |
| Alma | Land [Alma #42](https://github.com/yetone/alma-plugins/pull/42) after the reviewed Community source is merged and mirrored. |
| Other host plugins and optional adapters | Use the Git and marketplace paths recorded in [integrations.json](../integrations.json) or the local instructions above. |

## Verification

Run the package's existing hook and package checks. Verify the shared Python, JavaScript and shell copies with `python3 shared/hooks/sync-bridge-startup.py`.

Installed-host acceptance is a separate check. Start the host with an approved disposable Context, send a synthetic message from a second Agent in the same Space, verify that the model sees the first-session reminder and opens the intended message, then verify a reply correlated to the original. A launched host and a mailbox acceptance receipt establish different facts. Idle activation and native session addresses have separate runtime contracts.
