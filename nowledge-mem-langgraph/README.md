# Nowledge Mem for LangGraph

First-class, identity-aware memory for agents built with LangGraph. The connector
keeps LangGraph responsible for execution and checkpointing while Nowledge Mem
provides cross-agent context, governed memory, retrieval, and durable Threads.

## Install

```bash
pip install nowledge-mem-langgraph
```

Run Nowledge Mem locally, or configure a remote Mem server:

```bash
export NMEM_API_URL=https://your-mem-server
export NMEM_API_KEY=nmem_...
export NMEM_LANGGRAPH_APP_ID=customer-support
```

`NMEM_LANGGRAPH_APP_ID` is a stable deployment slug. Keep it unchanged across
releases so a LangGraph `thread_id` continues to map to the same Mem Thread.

## `create_agent`: complete integration

```python
from dataclasses import dataclass

from langchain.agents import create_agent
from nowledge_mem_langgraph import NowledgeClient, NowledgeMiddleware


@dataclass
class AgentContext:
    user_id: str
    nowledge: dict[str, str]


mem = NowledgeClient()
tools = await mem.tools()
agent = create_agent(
    model="openai:gpt-5.4",
    tools=tools,
    middleware=[NowledgeMiddleware(mem)],
    context_schema=AgentContext,
)

result = await agent.ainvoke(
    {"messages": [{"role": "user", "content": "What did we decide last week?"}]},
    config={"configurable": {"thread_id": "ticket-1842"}},
    context=AgentContext(
        user_id="auth-user-42",
        nowledge={
            "agent_id": "support-triage",
            "space_id": "customer-acme",
        },
    ),
)
```

The middleware:

- reads the selected Agent's Context Bundle once per top-level turn
- injects it into the model request without adding it to graph state or checkpoints
- gives MCP calls trusted Agent and Space headers, overriding model-authored scope
- imports the completed top-level conversation through `POST /threads/import`
- skips nested subgraph checkpoints, so subagents do not duplicate the parent Thread
- marks Mem retrieval tool results as external context so distillation cannot learn
  its own recalled output again

Both `invoke()` and `ainvoke()` work for middleware context and Thread sync. MCP
tool loading and execution use the async interface provided by
`langchain-mcp-adapters`, so agents using Mem tools should use `ainvoke()`.

## Agent identity

Identity and authorization are deliberately separate:

| Value | Meaning | Example |
| --- | --- | --- |
| API key | Authorization and workspace access | `NMEM_API_KEY` |
| `agent_id` | Portable Nowledge Agent profile | `support-triage` |
| `host_agent_id` | LangGraph deployment provenance | `langgraph:support:prod-v3` |
| `space_id` | Memory and retrieval scope | `customer-acme` |
| LangGraph `thread_id` | Canonical conversation identity | `ticket-1842` |
| LangGraph `assistant_id` | Mutable deployment/config instance | not a Thread ID |

Put invocation-scoped selectors under `context.nowledge`. Do not derive them
from prompt text or from LangGraph's authenticated user. A server `graph_id` and
`assistant_id` are recorded automatically as host provenance when no explicit
`host_agent_id` is supplied. They never grant access.

Static defaults use the portable environment variables:

```bash
export NMEM_AGENT_ID=support-triage
export NMEM_HOST_AGENT_ID=langgraph:support:prod
export NMEM_SPACE=customer-acme
```

Invocation context takes precedence over these defaults. If an invocation sets
either Agent selector, the connector does not combine it with the other static
selector; this prevents cross-tenant identity mixtures in shared deployments.

## Raw `StateGraph`

Raw graphs have arbitrary topology, so no library can honestly infer the right
model node or completion boundary. Use the explicit client helpers:

```python
from nowledge_mem_langgraph import NowledgeClient, NowledgeIdentity

mem = NowledgeClient()
identity = NowledgeIdentity(agent_id="researcher", space_id="project-atlas")

bundle = await mem.acontext_bundle(identity)
tools = await mem.tools()

# At your graph's real completion boundary:
await mem.async_thread(
    thread_id=runtime.execution_info.thread_id,
    messages=state["messages"],
    identity=identity,
    runtime=runtime,
)
```

Keep Context Bundle text transient in the model request. Do not add it to a
checkpointed `messages` channel.

## Subagents and subgraphs

LangGraph subgraphs share the parent `thread_id` and receive a nested checkpoint
namespace. The middleware syncs only the top-level namespace. This produces one
canonical Mem Thread for the user conversation while preserving subagent
activity in LangGraph's own checkpoints and traces.

If a subagent is an independently addressable product agent with its own durable
conversation, give it a different LangGraph `thread_id` and its own Nowledge
Agent identity. Do not use `assistant_id` to split a shared conversation.

## Reliability boundary

Context reads and Thread sync are fail-open by default: a transient Mem outage
does not take down the customer agent. Set `fail_open=False` for workflows where
memory availability is mandatory. Scope and authorization are never relaxed on
failure.

Thread sync is awaited rather than dispatched as an untracked background task,
so serverless workers cannot terminate before the import finishes. Exact replays
are no-ops and longer conversations append only their missing messages.

## What this connector is not

- It is not a LangGraph checkpointer. Keep the checkpointer that owns execution state.
- It is not a `BaseStore` replacement. Memories have provenance, governance, and
  semantic relationships that a generic key-value store does not represent.
- It does not use LangSmith traces as transcripts. Traces contain nested execution
  events, not the canonical user conversation.
- It cannot recover messages summarized away before the connector was installed.

See the [full guide](https://mem.nowledge.co/docs/integrations/langgraph) for
deployment and migration guidance.
