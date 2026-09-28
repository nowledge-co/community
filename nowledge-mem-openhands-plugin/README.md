# Nowledge Mem Plugin for OpenHands

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenHands SDK](https://img.shields.io/badge/OpenHands-Plugin-green.svg)](https://docs.openhands.dev/sdk/guides/plugins)

Cross-agent persistent memory, startup context, memory rules, and agent skills for [OpenHands](https://docs.openhands.dev) and multi-agent orchestrations.

---

## Overview

In multi-agent systems and orchestrations like **OpenHands**, multiple agents (e.g. planner, coder, reviewer, architect, researcher) cooperate to complete complex software engineering tasks. While OpenHands manages local conversation execution and tool execution, **Nowledge Mem** serves as the persistent, cross-agent knowledge layer.

This plugin aligns OpenHands with multi-agent orchestrators (such as Raft, Multica, Paseo):

- **Startup Context Injection**: `UserPromptSubmit` hook automatically injects the latest Context Bundle or Working Memory briefing into the agent context.
- **Multi-Agent Identity Awareness**: Supports `NMEM_AGENT_ID` (e.g. `planner`, `coder`, `reviewer`) to distinguish worker node provenance across shared canvas runs.
- **Space-Aware Execution**: Route memories and threads to specific spaces (`NMEM_SPACE`) or share knowledge across the entire canvas workspace.
- **Direct MCP Integration**: Zero-overhead tool retrieval via Nowledge Mem Model Context Protocol (`.mcp.json`).
- **Autonomous Memory Distillation**: Bundles canonical skills to search, distill, and handoff insights proactively.
- **Session Capture on Stop**: `Stop` lifecycle hook records conversation threads and milestones.

---

## Directory Structure

```text
nowledge-mem-openhands-plugin/
├── .plugin/
│   └── plugin.json          # OpenHands plugin manifest
├── .mcp.json                # MCP server configuration
├── mcp.json                 # Standard MCP configuration alias
├── hooks/
│   ├── hooks.json           # Lifecycle hook definitions
│   ├── nmem_shared.py       # Shared HTTP/CLI runtime
│   ├── nmem-context.py      # UserPromptSubmit hook
│   ├── nmem-post-tool.py    # PostToolUse hook
│   └── nmem-stop.py         # Stop hook
├── skills/
│   ├── read-working-memory/ # Load Context Bundle / Working Memory
│   ├── search-memory/       # Proactive semantic & graph search
│   ├── distill-memory/      # Proactive memory distillation
│   ├── save-handoff/        # Canvas node checkpoint / handoff
│   ├── save-thread/         # Full thread synchronization
│   ├── status/              # Connection & space diagnostics
│   └── check-integration/  # Diagnostic & setup verification
├── rules/
│   └── nowledge-mem.md      # Memory rules for OpenHands agents
├── AGENTS.md                # Persistent memory contract
├── CHANGELOG.md             # Release notes
└── README.md                # Documentation
```

---

## Installation

### 1. Using OpenHands SDK

Load the plugin via the OpenHands SDK `Plugin` loader:

```python
from pathlib import Path
from openhands.sdk import Agent, AgentContext, Conversation
from openhands.sdk.plugin import Plugin

# Load Nowledge Mem plugin
plugin = Plugin.load("path/to/nowledge-mem-openhands-plugin")

# Attach skills and MCP config to the Agent
agent = Agent(
    llm=llm,
    tools=tools,
    mcp_config=plugin.mcp_config or {},
    agent_context=AgentContext(skills=plugin.skills),
)

# Attach lifecycle hooks to the Conversation
conversation = Conversation(
    agent=agent,
    workspace=workspace_dir,
    hook_config=plugin.hooks,
)

conversation.send_message("Let's build the new authentication flow.")
conversation.run()
```

### 2. In OpenHands Workspace

Place the plugin inside your project's plugin directory (`.openhands/plugins` or `.agents/plugins`):

```bash
mkdir -p .openhands/plugins
git clone --depth 1 https://github.com/nowledge-co/community.git /tmp/community
cp -r /tmp/community/nowledge-mem-openhands-plugin .openhands/plugins/nowledge-mem
rm -rf /tmp/community
```

---

## Configuration & Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NMEM_API_URL` | Nowledge Mem REST API endpoint | `http://127.0.0.1:14242` |
| `NMEM_API_KEY` | API key for remote or authenticated Mem instances | (empty) |
| `NMEM_SPACE` | Active memory space for this canvas or agent | `default` |
| `NMEM_AGENT_ID` | Agent role identifier (`planner`, `coder`, `reviewer`) | (empty / derived) |
| `NMEM_DISABLE_PROMPT_INJECT` | Set to `1` to disable prompt context injection | `0` |
| `NMEM_DISABLE_AUTO_CAPTURE` | Set to `1` to disable automatic thread capture on stop | `0` |

---

## Lifecycle Hooks

Defined in `hooks/hooks.json`:

1. **`UserPromptSubmit`**:
   - Executes `hooks/nmem-context.py`.
   - Fetches the active Context Bundle (or Working Memory) via local REST API (`<30ms`).
   - Injects structured context (`additionalContext`) into the agent's turn.
2. **`PostToolUse`**:
   - Executes `hooks/nmem-post-tool.py`.
   - Watches tool calls (e.g. `file_editor`, `terminal`) to record relevant documentation and plan edits.
3. **`Stop`**:
   - Executes `hooks/nmem-stop.py`.
   - Captures conversation thread state and registers it into Nowledge Mem.

---

## MCP Server Configuration

Configured in `.mcp.json` and `mcp.json`:

```json
{
  "mcpServers": {
    "nowledge-mem": {
      "type": "http",
      "url": "http://127.0.0.1:14242/mcp"
    }
  }
}
```

> **Note**: Active connector artifacts strictly use `http://127.0.0.1:14242/mcp` without a trailing slash.

---

## Bundled Skills

- **`read-working-memory`**: Read the daily briefing and active focus areas at session start.
- **`search-memory`**: Proactively search knowledge graphs and past threads.
- **`distill-memory`**: Distill durable facts, architecture decisions, and procedures.
- **`save-handoff`**: Save a clean progress checkpoint when handing off between canvas nodes.
- **`save-thread`**: Synchronize session history to Nowledge Mem.
- **`status`**: Check server connection, version, active space, and CLI diagnostics.
- **`check-integration`**: Verify setup, doctor diagnostics, and troubleshooting guide.

---

## Architecture & Data Flow

```mermaid
flowchart TD
    subgraph OpenHands["OpenHands Runtime / Canvas"]
        User["User Prompt / Canvas Trigger"] --> HookContext["UserPromptSubmit Hook"]
        HookContext --> AgentLoop["Agent Execution Loop"]
        AgentLoop --> ToolExec["Tool Call (File / Bash / MCP)"]
        ToolExec --> HookTool["PostToolUse Hook"]
        HookTool --> AgentLoop
        AgentLoop --> EventDisk[("OpenHands Events on Disk\nevents/event-*.json")]
        AgentLoop --> HookStop["Stop Hook"]
    end

    subgraph PluginRuntime["Nowledge Mem Plugin Runtime (hooks/)"]
        HookContext -->|REST <30ms| GetContext["Read Context Bundle / WM"]
        HookStop --> Parser["Tier-2 Event Parser\n(parse_openhands_events)"]
        EventDisk -.->|Read JSONL/JSON| Parser
        Parser --> Cleaner["Noise Filter & Turn Deduplication"]
        Cleaner --> SyncStrategy{"Sync Transport"}
    end

    subgraph SyncTiers["3-Tier Synchronization"]
        SyncStrategy -->|Tier 1: REST <30ms| FastREST["POST /threads/import"]
        SyncStrategy -->|Tier 2: CLI Fallback| CLIImport["nmem t import"]
        SyncStrategy -->|Tier 3: Offline Buffer| FileLockQueue[("~/.nowledge-mem/plugins/\nopenhands/unsynced.json")]
        FileLockQueue -.->|Async Drain on Next Stop| FastREST
    end

    subgraph MemBackend["Nowledge Mem Server"]
        GetContext <---> MemBackend
        FastREST --> MemBackend
        CLIImport --> MemBackend
    end
```

### 1. Startup Context Injection (`UserPromptSubmit`)
- When a user submits a prompt, `hooks/nmem-context.py` runs before the agent begins planning.
- Directly queries Nowledge Mem's REST endpoint (`GET /context/bundle` or fallback `GET /working-memory`) with low latency (<30ms).
- Formats persistent knowledge into an `additionalContext` payload, giving the agent immediate situational awareness of prior decisions, preferences, and workspace conventions.

### 2. Native Tier-2 Event Parsing
- Unlike naive single-turn capture, OpenHands writes discrete event objects into `events/event-*.json` (or `.openhands/conversations/<id>/events/`).
- `hooks/nmem_shared.py` discovers the session directory via multi-path search supporting both hyphenated UUIDs (`8af0ab76-52c7-...`) and unhyphenated 32-character hex IDs (`8af0ab7652c7...`).
- Inspects `MessageEvent`, `ActionEvent`, and `ObservationEvent`:
  - Retains human-visible user prompts and assistant explanations.
  - Strips noisy execution churn (raw bash outputs, polling loops, transient tool stdout).
  - Deduplicates consecutive identical assistant turns.

### 3. Three-Tier Transport & Resilience
- **Tier 1 (Fast REST)**: Imports the thread directly via `POST /threads/import` with Bearer auth support for instant persistence.
- **Tier 2 (CLI Fallback)**: If REST is unreachable or returns a non-2xx status, falls back to `nmem t import --id "openhands-<id>" --messages '<json>' --source openhands`.
- **Tier 3 (Offline Buffer)**: If Nowledge Mem is temporarily offline, the session is queued in an atomic, file-locked outbox (`~/.nowledge-mem/plugins/openhands/unsynced.json`). Queued sessions are automatically drained and replayed in the background on the next session stop.

---

## Multi-Agent Orchestration & Child ACP Deduplication

When OpenHands runs in multi-agent workflows or launches child agents using the Agent Control Protocol (ACP) — such as Claude Code, Codex, or custom specialist subagents — coordination is required to prevent duplicate threads.

### The Double-Capture Risk

If both OpenHands and a child ACP agent have Nowledge Mem plugins installed:
1. **OpenHands Stop Hook** captures the session as `thread_id: "openhands-<openhands_session_id>"` (`source: "openhands"`).
2. **Child Agent Stop Hook** captures the session as `thread_id: "claude-code-<claude_session_id>"` (`source: "claude-code"`).
3. **Collision**: Because Nowledge Mem namespaces threads by `thread_id`, both threads are persisted independently, creating duplicate entries with overlapping conversational events.

### Ecosystem Orchestrator Patterns

| Orchestrator | Paradigm | Capture Strategy | Deduplication Mechanism |
| :--- | :--- | :--- | :--- |
| **OpenHands** | `orchestrator` | Hook-capture | Host-authoritative transcript via Stop hook; child ACP auto-capture suppressed via environment. |
| **Raft** | `orchestrator` | Host-native | Child Codex hook detects `originator: raft-daemon` and automatically skips child capture (`skip: delegated conversation host owns thread capture`). |
| **Lody / Multica / Cumora / Cindy** | `child-runtime` | Delegated | The orchestrator never captures transcripts. Thread capture is 100% delegated to the launched child tool plugin (e.g. Claude Code or Codex). |
| **Paseo** | `registry-guided` | Child + Sync | Child captures live; historical sync reuses the child's `thread_id` to prevent duplicate parent entries. |
| **WorkBuddy** | `multi-agent` | Subagent stop | Separates parent and subagent threads using distinct `agent_id` mappings. |

### Operational Guidance: Choosing Authoritative Mode

#### Mode A: Host-Authoritative (Recommended for OpenHands)
OpenHands captures the clean, human-visible multi-agent conversation. Child ACP agents still have full access to Nowledge Mem tools, but do not create redundant child threads.

In the environment of child ACP workers, set:
```bash
NMEM_DISABLE_AUTO_CAPTURE=1
```
Connectors that support this toggle will suppress saving duplicate threads on exit while retaining full access to tools like `memory_search`, `read_working_memory`, and `memory_add`.

#### Mode B: Child-Authoritative (Detailed Tool Traces)
If you prefer low-level, command-by-command tool traces captured by child tool runtimes rather than OpenHands' high-level conversation:
1. Set `NMEM_DISABLE_AUTO_CAPTURE=1` in the OpenHands orchestrator environment.
2. Allow child runtime connectors to handle thread capture under their native namespaces.

### Node Identity & Space Routing

In complex multi-agent graphs:
- Set `NMEM_AGENT_ID=<role>` (e.g. `planner`, `coder`, `reviewer`, `architect`) on specialist worker nodes to tag memory additions and handoffs with worker provenance.
- Set `NMEM_SPACE=<space-slug>` to route memories and threads to a specific project lane, or leave unset to use the default space.

---

## Verification

To verify that the plugin is working:

```bash
# Check connectivity
nmem --json status

# Test hook execution
python3 hooks/nmem-context.py < /dev/null
```
