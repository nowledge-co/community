# Nowledge Mem for OpenClaw

Use this guide when an AI agent is helping a user install, configure, verify, or explain the Nowledge Mem OpenClaw plugin.

Nowledge Mem is not just "memory for OpenClaw." It is the user's shared memory layer across OpenClaw, Claude Code, Cursor, browser capture, imported threads, and documents. OpenClaw joins that context exchange.

## Use This When

- The user wants to install or configure the OpenClaw plugin
- The user wants OpenClaw to connect to existing Nowledge Mem data
- The user wants local-first memory on this machine
- The user wants remote or multi-machine memory through a remote `apiUrl`
- The user wants to verify that OpenClaw can recall, save, and search memory

## Do Not Use This When

- The user only wants temporary context in the current OpenClaw session
- The user is troubleshooting unrelated OpenClaw issues
- The user only wants direct MCP setup for another client

## Product Framing

When talking to users:

- Say "Nowledge Mem gives OpenClaw the same shared memory your other AI tools can use."
- Lead with cross-tool continuity, not with plugin internals.
- For local mode, say "No API key is needed for local mode."
- For remote mode, say "Set `apiUrl`, and add `apiKey` when the server requires auth."
- Do not imply that OpenClaw is the only source of truth. It is one client of the user's larger memory system.
- Do not imply that cloud backup is the default. Our default story is local-first.

Good user-facing explanation:

> OpenClaw can now read the same memory you already built in your other AI tools, and what happens in OpenClaw can enrich that shared memory too.

## Definition of Done

This task is not complete until all of the following are true:

1. `nmem` is available
2. The intended backend is verified reachable with `nmem`
3. The OpenClaw plugin is installed
4. OpenClaw is using the Nowledge Mem memory slot
5. Remote config is written only if the user chose remote mode
6. OpenClaw is restarted
7. `openclaw nowledge-mem status` succeeds
8. The user receives a short handoff covering:
   - one real first question to ask
   - how to bring in older history
   - local vs remote expectations
   - trust pinning if they see `plugins.allow` warnings

## Setup Flow

### Step 0 — Choose Local or Remote

Ask the user which setup they want:

1. Local Nowledge Mem already running on this machine
2. Existing remote Nowledge Mem server

Explain the difference plainly:

- Local mode: OpenClaw talks to the local Nowledge Mem app/server through `nmem`
- Remote mode: OpenClaw talks to a remote Nowledge Mem server through `nmem --api-url ...`; add `apiKey` when that server has auth enabled
- If the user wants one agent-specific lane, use plugin config `space` first, plugin config `spaceTemplate` only when the launcher already exposes a trustworthy lane signal, and `NMEM_SPACE="<space name>"` only as the fallback for CLI-style launches instead of inventing a second OpenClaw-only memory namespace

### Step 1 — Verify `nmem`

```bash
nmem --version
```

If this fails:

- For users with the desktop app, direct them to **Settings > Preferences > Developer Tools > Install CLI**
- Otherwise suggest `pip install nmem-cli`, or on Arch Linux `yay -S nmem-cli` / `paru -S nmem-cli`

### Step 2 — Verify the Backend Before Plugin Setup

Local mode:

```bash
nmem --json status
```

Remote mode without auth:

```bash
nmem --json --api-url "$API_URL" status
```

Remote mode with auth:

```bash
NMEM_API_KEY="$API_KEY" nmem --json --api-url "$API_URL" status
```

Success means the backend responds correctly through `nmem`. Do not skip this step and assume the URL/auth is right.

### Step 3 — Install the Plugin

Default install:

```bash
openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem
```

If this fails with `archive integrity mismatch`, update OpenClaw first, then
retry. Current ClawHub packages require OpenClaw 2026.5.3 or later.

To update an existing install:

```bash
openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem --force
```

Alternatively, if the user is installing from OpenClaw's default registry rather than ClawHub, this also works:

```bash
openclaw plugins install @nowledge/openclaw-nowledge-mem
```

Important facts:

- The installer already writes the install record
- The installer already enables the plugin
- The installer already switches the `memory` slot to `openclaw-nowledge-mem`

Do not tell the user to hand-edit those settings unless they are using a manual/path setup.

### Step 3a — Grant the Runtime Capabilities the Plugin Uses

Current OpenClaw releases require an explicit grant before a non-bundled plugin
can read conversation content from `agent_end`. Set it after install:

```bash
openclaw config set plugins.entries.openclaw-nowledge-mem.hooks.allowConversationAccess true --strict-json
```

Then inspect the host's effective tool policy:

```bash
openclaw config get tools
```

- If `tools.allow` already exists, preserve that list and add
  `openclaw-nowledge-mem` to it.
- Otherwise, when a restrictive profile such as `coding`, `messaging`, or
  `minimal` is set, preserve `tools.alsoAllow` and add
  `openclaw-nowledge-mem` to it.
- If no restrictive profile or allowlist exists, no tool-policy change is
  needed.
- Never replace an existing list, and never add individual `nowledge_mem_*`
  names. The plugin id expands to the complete manifest-declared tool contract.

Example for a `coding` profile with no prior `alsoAllow` entries:

```bash
openclaw config set tools.alsoAllow '["openclaw-nowledge-mem"]' --strict-json
```

### Step 4 — Configure Remote Only When Needed

Local mode:

- No extra config is required

Remote mode:

- Prefer setting `apiUrl` and `apiKey` in the OpenClaw plugin settings
- Use `~/.nowledge-mem/openclaw.json` only when the user wants a stable machine-local override or scripted setup

`~/.nowledge-mem/openclaw.json` example:

```json
{
  "apiUrl": "https://nowledge.example.com",
  "apiKey": "your-api-key-here"
}
```

Important precedence rule:

- `~/.nowledge-mem/openclaw.json` overrides OpenClaw plugin settings
- Then plugin settings override inherited environment variables
- Do not assume stale `NMEM_API_URL` or `NMEM_API_KEY` env vars should keep winning

If the remote server does not require auth, omit `apiKey`.

### Step 5 — Pin Trust When Appropriate

If OpenClaw warns that `plugins.allow` is empty, or the user wants explicit trust for non-bundled plugins, add:

```json
{
  "plugins": {
    "allow": ["openclaw-nowledge-mem"]
  }
}
```

Explain this correctly:

- `plugins.allow` trusts the plugin id
- It does not pin the plugin source path
- If the user also has linked or workspace copies in `plugins.load.paths`, they should review those too

### Step 6 — Restart OpenClaw

Restart OpenClaw so the plugin and hooks are active.

If an agent is doing the restart automatically, tell the user before triggering it.

### Step 7 — Verify the Plugin

First check the plugin status:

```bash
openclaw nowledge-mem status
```

If only `memory_search` and `memory_get` tools are available (other Nowledge Mem tools missing), inspect `openclaw config get tools` first. A restrictive profile needs the plugin id in `tools.alsoAllow`, or in the existing `tools.allow` list. Then verify the memory slot in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "slots": { "memory": "openclaw-nowledge-mem" }
  }
}
```

If missing, reinstall (`openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem`) which sets the slot automatically. This is common after upgrading OpenClaw to 3.22+ where the default memory slot changed.

Then verify in chat.

For a clean synthetic check:

1. `/remember We chose PostgreSQL for task events`
2. `/recall PostgreSQL`
3. `/new`
4. Ask `What database did we choose for task events?`

If the user already has real memory in Nowledge Mem, prefer a real question over a synthetic demo. Good examples:

- `What was I working on this week?`
- `What did we already decide about the task API?`
- `Find the conversation where we discussed Redis caching`

## Handoff Message

After setup succeeds, send a short handoff that covers all four points:

1. OpenClaw is now connected
2. The best next question to ask
3. How to bring in older history
4. What the local/remote trust model is

Good structure:

```text
OpenClaw is now connected to Nowledge Mem.

Try this next:
- Ask OpenClaw: "What was I working on this week?"

If you want more history:
- Import old AI threads or browser-captured chats into Nowledge Mem so OpenClaw can search them too.

What to expect:
- Local mode needs no API key.
- Remote mode uses the same apiUrl and, when auth is enabled, the same apiKey you already verified with nmem.
- If OpenClaw warns that plugins.allow is empty, add openclaw-nowledge-mem to the allowlist to pin trust explicitly.
```

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| `nmem --json status` fails in local mode | Start Nowledge Mem locally first |
| Remote mode fails | Re-run `nmem --json --api-url ... status` with the exact URL and auth you plan to use |
| `openclaw nowledge-mem status` fails after install | Restart OpenClaw and confirm the plugin was installed successfully |
| ClawHub reports `archive integrity mismatch` | Update OpenClaw to 2026.5.3+ or latest, then reinstall with `openclaw plugins install clawhub:@nowledge/openclaw-nowledge-mem --force` |
| `plugins.allow is empty` warning | Add `openclaw-nowledge-mem` to `plugins.allow` if the user wants explicit trust |
| Remote config seems ignored | Check whether `~/.nowledge-mem/openclaw.json` is overriding plugin settings |
| Local mode unexpectedly talks to a remote server | Check for stale `NMEM_API_URL` / `NMEM_API_KEY` in the environment or an overriding `~/.nowledge-mem/openclaw.json` |
| Plugin tools missing | Inspect `openclaw config get tools`. Under a restrictive profile, preserve `tools.alsoAllow` and add `openclaw-nowledge-mem`; if `tools.allow` already exists, add the plugin id there instead. Do not add individual `nowledge_mem_*` names. Also ensure the plugin is trusted in `plugins.allow`. |
| Memory tools work but Threads do not sync | Update to `0.8.30+`, set `plugins.entries.openclaw-nowledge-mem.hooks.allowConversationAccess=true`, restart the gateway, and verify with `nmem t list --source openclaw -n 20`. |
| `must declare contracts.tools before registering agent tools` | Update the plugin to `0.8.27+` and restart OpenClaw. Newer OpenClaw builds require plugin authors to declare tool ownership in the manifest before runtime tool registration. |

## Notes for Agents

- Human docs and AI setup instructions are different things. Keep the human explanation short and concrete.
- Do not dump the whole configuration model on the user up front.
- Do not reduce Nowledge Mem to "OpenClaw memory." The real value is shared context across tools and growth of knowledge over time.
