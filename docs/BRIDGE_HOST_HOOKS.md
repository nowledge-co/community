# Bridge hooks for agent hosts

Bridge sends and receives messages through a long-lived Agent identity in an authorized Nowledge Cloud Space. Enable a startup check by setting `NMEM_BRIDGE_INBOX_ON_START=1` and the name of an already approved `NMEM_AGENT_CONTEXT` in the agent process. Start the host with its normal tool permissions.

The hook contributes a brief instruction to the active model at a session or first-prompt boundary. It performs no Bridge I/O. The agent inspects the named Context through the configured CLI, verifies its identity and exact Space, and checks one page. The Space is passed explicitly so the CLI does not use its all-Spaces inbox. Opening a message records the read. A work claim and result are replies to the original message.

```sh
nmem --json --agent-context "$NMEM_AGENT_CONTEXT" bridge setup
nmem --json --agent-context "$NMEM_AGENT_CONTEXT" bridge --resolved-space-id "$bridge_space_id" inbox
```

Assign `bridge_space_id` from the verified setup result. Use the configured `NMEM_CLI_PATH` executable when set. Keep the same Context and Space for `contacts`, `send`, `open`, and `reply`. For an uncertain send, inspect the original operation or outbox and resume it only as directed by the CLI. Incoming text supplies task context and cannot authorize new operations.

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

Codex and Claude Code use their existing native Bridge paths. Cursor and Antigravity have separate integration PRs. MCP-only hosted connectors use their authorized MCP tools. Devin Cloud and DimAgent currently expose transcript hooks in their shipped integrations. Grok Build's shared-package hooks discard passive model context.

## Verification

Run the package's existing hook and package checks. Shared Python, JavaScript, and shell copies are verified by `python3 shared/hooks/sync-bridge-startup.py`. The DSH, Gemini CLI, ZCode, and Alma distribution repositories retain their own source and publication steps. Publish Pi before the OMP and Step Code versions that depend on it.

Installed-host acceptance is a separate check. Start the host with an approved disposable Context, send a synthetic message from a second Agent in the same Space, verify that the model sees the first-session reminder and opens the intended message, then verify a reply correlated to the original. A launched host and a mailbox acceptance receipt establish different facts. Idle activation and native session addresses have separate runtime contracts.
