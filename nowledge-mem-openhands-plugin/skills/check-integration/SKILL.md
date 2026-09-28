---
name: check-integration
description: Check Nowledge Mem setup, detect your OpenHands agent environment, and guide plugin installation and configuration.
trigger:
  type: keyword
  keywords:
    - setup
    - config
    - integration
    - doctor
    - test
    - openhands
---

# Check Connector

> Verify Nowledge Mem setup and guide configuration for OpenHands and OpenHands SDK.

## When to Use

- User asks about Nowledge Mem setup in OpenHands
- Memory tools or hooks fail or are missing
- First time running Nowledge Mem in OpenHands
- Upgrading or troubleshooting multi-agent orchestration memory

## Step 1: Verify nmem CLI and Local Server

```bash
nmem --json status
```

- If `reachable: true`, Nowledge Mem is operational.
- If unreachable and on desktop, launch Nowledge Mem Desktop.
- If running on a remote container or cloud VM:
  ```bash
  python3 -m pip install --user nmem-cli
  nmem config client set url https://<your-mem-server>
  nmem config client set api-key <your-api-key>
  nmem --json status
  ```

## Step 2: OpenHands Plugin Setup

### Using OpenHands SDK

Load the plugin directly:

```python
from openhands.sdk.plugin import Plugin
from openhands.sdk import Agent, Conversation

plugin = Plugin.load("path/to/nowledge-mem-openhands-plugin")

agent = Agent(
    llm=llm,
    tools=tools,
    mcp_config=plugin.mcp_config or {},
    agent_context=AgentContext(skills=plugin.skills),
)

conversation = Conversation(
    agent=agent,
    hook_config=plugin.hooks,
)
```

### In OpenHands Workspace

Place the plugin in your workspace or persistent plugins directory:

```bash
# Clone or link to .plugins
mkdir -p .plugins
git clone https://github.com/nowledge-co/community.git /tmp/community
cp -r /tmp/community/nowledge-mem-openhands-plugin .plugins/nowledge-mem
```

## Step 3: Multi-Agent Configuration

For orchestrations (Raft, Multica, Paseo, OpenHands multi-agent graphs):

- Set `NMEM_AGENT_ID="<role>"` (e.g. `planner`, `coder`, `reviewer`) to distinguish worker nodes.
- Set `NMEM_SPACE="<space-name>"` for project-level or team-level memory isolation.
- Verify with `nmem context --source-app openhands`.
