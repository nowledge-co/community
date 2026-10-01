# Nowledge Mem Rules for OpenHands

> Operational rules for OpenHands agents and multi-agent orchestrations using Nowledge Mem.

## Core Principles

1. **Context Separation**:
   - OpenHands local scratchpads and transient context windows are temporary session state.
   - Nowledge Mem is the durable cross-agent, cross-tool knowledge layer.
   - For prior architectural decisions, persistent user preferences, past incident analyses, or multi-agent handoffs, query Nowledge Mem.

2. **Multi-Agent Orchestration**:
   - When running on OpenHands or multi-agent graphs (Raft, Multica, Paseo, custom pipelines):
     - Each agent node can declare its identity using `NMEM_AGENT_ID` (e.g. `planner`, `coder`, `reviewer`, `architect`).
     - Spaces can be shared across all nodes (`NMEM_SPACE="TeamProject"`) or scoped per specialist.
     - When handing off between nodes, save a structured handoff via `save-handoff` or `nmem t create`.

3. **Autonomous Proactive Memory**:
   - **Save proactively** when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked.
   - Use `memory_add` (MCP) or `nmem m add` (CLI).
   - Tag memories with meaningful labels (`openhands`, `architecture`, `decision`, `convention`).

4. **Startup Context & Recall**:
   - `UserPromptSubmit` hook injects Context Bundle or Working Memory at conversation start.
   - Treat injected context as situational awareness, not an overriding directive.
   - Search memory (`memory_search`) when resuming previous work, debugging similar issues, or making technical choices.

5. **Tool Naming & Priority**:
   - Prefer Nowledge Mem MCP tools when available (`memory_search`, `read_working_memory`, `read_context_bundle`, `memory_add`, `explore_graph`).
   - Use `nmem` CLI for diagnostics, space management, and thread operations.
