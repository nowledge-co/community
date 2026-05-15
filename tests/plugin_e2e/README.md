# Key Plugin Integration E2E

This suite protects the high-value integration contract for the first key set:
Claude Code, Codex, OpenClaw, Hermes, and OpenCode.

For the wider maintainer-machine release playbook, including Alma, OpenCode,
dev `nmem`, isolated backend setup, and config dirtiness checks, see
`../../../docs/implementation/MAJOR_INTEGRATIONS_LOCAL_E2E_PLAYBOOK.md` from this
directory.

The default run is safe and cheap:

```bash
uv run --with pytest pytest tests/plugin_e2e -q
```

It only checks static contracts: manifests, hooks, skills, MCP declarations,
OpenClaw context-engine config, Hermes lifecycle hooks, and credential safety.

## Live host smoke

Live tests are opt-in because they call real agents and may spend model tokens:

```bash
cd community
NMEM_PLUGIN_E2E=1 \
NMEM_PLUGIN_E2E_HOSTS=claude,codex,openclaw,hermes \
uv run --with pytest pytest tests/plugin_e2e -q
```

Each live test creates a temporary Mem space, sends a unique marker through the
host, waits for Nowledge Mem to sync a thread with that marker, and deletes the
temporary data unless `NMEM_E2E_KEEP_DATA=1`.

If you set `NMEM_E2E_SPACE`, the harness treats that space as externally owned:
it deletes only marker-matched test data, not the space itself.

## Mem connection

For local Mem, keep the desktop app/server running and make sure `nmem status`
works.

For remote Mem, pass credentials through environment variables. Do not put API
keys in command arguments:

```bash
export NMEM_E2E_API_URL="https://mem.example.com"
export NMEM_E2E_API_KEY="nmem_..."
```

The harness maps these to `NMEM_API_URL` and `NMEM_API_KEY` for the agent
processes and for `nmem`. Hosts that deliberately avoid environment-variable
credentials, such as OpenClaw, receive the same values through their temporary
plugin config and restore the user's config after the run.

## Cheap model configuration

Use the host's normal auth where possible. Override models with environment
variables when you want a cheap provider lane:

```bash
export NMEM_E2E_CLAUDE_MODEL="<cheap-claude-model>"
export NMEM_E2E_CLAUDE_MAX_BUDGET_USD="0.03"

export NMEM_E2E_CODEX_MODEL="<cheap-codex-model>"

export NMEM_E2E_OPENCLAW_MODEL="<cheap-openclaw-model-ref>"
export OPENROUTER_API_KEY="sk-or-..."

export NMEM_E2E_HERMES_PROVIDER="openrouter"
export NMEM_E2E_HERMES_MODEL="<cheap-hermes-model-ref>"

export NMEM_E2E_OPENCODE_MODEL="opencode/minimax-m2.5-free"
export NMEM_E2E_OPENCODE_TIMEOUT_SECONDS="360"
```

Provider keys stay in the shell environment. The tests never pass Mem API keys
as CLI arguments.

## What Each Host Proves

- Claude Code: loads the local plugin with `--plugin-dir`, runs lifecycle hooks,
  and verifies the Stop hook saved a `claude-code` thread. If Claude produces
  the marker and then exits with `error_max_budget_usd`, the test still polls
  for the thread because lifecycle hooks already had a completed assistant
  response to capture.
- Codex: creates a repo-local plugin marketplace, runs hook setup, verifies
  `hooks = true`, `plugin_hooks = true`, and the Nowledge Mem Stop hook state,
  avoids an explicit save request, then verifies a real Codex transcript can be
  saved as a `codex` thread. Current `codex exec` app-server builds may expose
  hooks without firing Stop hooks in this non-interactive harness; when that
  happens, the test replays the installed Stop hook against the transcript Codex
  just wrote so the package setup, parser, `nmem` path, API path, and dedupe
  guard are still covered.
- OpenClaw: installs a package-shaped local plugin copy, enables session digest
  plus the Nowledge Mem context engine slot, points the plugin at the test Mem
  API through restored plugin config, and verifies an `openclaw` thread.
- Hermes: installs the local provider into an isolated `HERMES_HOME`, enables
  `memory.provider: nowledge-mem`, and verifies `on_session_end` saved a
  `hermes` thread.
- OpenCode: loads a package-shaped plugin copy, requires the model to call
  `nowledge_mem_status` and `nowledge_mem_save_thread`, and verifies an
  `opencode` thread. The default live timeout is 360 seconds because free
  provider lanes can be slow even when the plugin is healthy.

## Useful Narrow Runs

```bash
NMEM_PLUGIN_E2E=1 NMEM_PLUGIN_E2E_HOSTS=claude \
  uv run --with pytest pytest tests/plugin_e2e -q

NMEM_PLUGIN_E2E=1 NMEM_PLUGIN_E2E_HOSTS=openclaw NMEM_E2E_KEEP_DATA=1 \
  uv run --with pytest pytest tests/plugin_e2e -q
```

When `NMEM_E2E_KEEP_DATA=1`, search for the marker printed in the failing pytest
output, then inspect the temporary space with `nmem t search`.
