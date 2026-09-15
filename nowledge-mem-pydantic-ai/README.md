# Nowledge Mem for Pydantic AI

Native [Pydantic AI](https://ai.pydantic.dev/) integration with Nowledge Mem:

- `NowledgeMem`: refresh Context Bundle once per run, expose Mem's MCP tools,
  and optionally capture the conversation as a Mem Thread.
- `NowledgeToolset`: expose the same tools without automatic context or capture.

**Status: experimental, source installation.** No PyPI release is required to
use this directory. The adapter targets Python 3.10+, Pydantic AI 2.43+ (before
3.0), and FastMCP 3.x. Pydantic AI 1.x and FastMCP 4.x are outside this version's supported
range. Durable execution with Temporal or DBOS is not supported.
Lifecycle capture is tested with `Agent.run()` and `Agent.run_sync()`;
streaming and UI adapter lifecycles are not qualified by this initial version.

## Install

From a checkout of this repository:

```bash
python -m pip install ./nowledge-mem-pydantic-ai
python -m pip install 'pydantic-ai-slim[openai]>=2.43,<3'
```

The second command installs one model provider; choose the provider extra your
application uses. The adapter itself only requires Pydantic AI's MCP extra.

Configure the **actual REST base URL and MCP endpoint shown by your Mem
connection settings**. The App's active port can vary. Do not guess a port or
copy an API key into a prompt. Use your application's secret store or environment:

```bash
export NMEM_API_URL='https://your-mem-server.example'
export NMEM_MCP_URL='https://your-mem-server.example/mcp'
export PYDANTIC_AI_MODEL='your-provider:your-model'
```

Set `NMEM_API_KEY` when your destination requires authentication. If omitted,
the adapter sends no Authorization header. Model-provider credentials are
configured separately through Pydantic AI.

By default, MCP is `${NMEM_API_URL}/mcp`. For a connection whose REST base ends
in `/remote-api`, set `NMEM_MCP_URL` to that connection's actual MCP endpoint.
REST and MCP must share an origin; redirects are not followed by the REST client.

## Context and tools

```python
import asyncio
import os

from pydantic_ai import Agent
from nowledge_mem_pydantic_ai import NowledgeMem


async def main() -> None:
    agent = Agent(
        os.environ["PYDANTIC_AI_MODEL"],
        capabilities=[NowledgeMem()],
    )
    result = await agent.run("What decisions did we make about the search index?")
    print(result.output)


asyncio.run(main())
```

The server owns the external-agent tool catalog and JSON schemas. The adapter
does not maintain a second list of search, save, or graph tools. The model can
call the tools that the configured server exposes, including write tools.
Disabling automatic capture does **not** make the toolset read-only; use server
permissions or a host-side tool filter when needed.

For a tools-only integration:

```python
import os

from pydantic_ai import Agent
from nowledge_mem_pydantic_ai import NowledgeToolset

agent = Agent(
    os.environ["PYDANTIC_AI_MODEL"],
    toolsets=[NowledgeToolset()],
)
```

## Trusted identity and Space

Static selectors come from `NMEM_AGENT_ID`, `NMEM_HOST_AGENT_ID`, and `NMEM_SPACE`,
or `NowledgeSettings(identity=NowledgeIdentity(...))`. Supply exact IDs, including
any concrete personal Space ID returned by Mem. An omitted selector delegates
to the server's default resolution; an explicit invalid selector is never
replaced by a default by this adapter.
For automatic context, the returned `active_space.primary_space_id` must match
an explicit Space ID. A successful HTTP response that falls back to another
Space raises `NowledgeScopeError`. Supply concrete IDs instead of aliases.

For a reusable agent, derive identity from trusted application dependencies:

```python
import os
from dataclasses import dataclass

from pydantic_ai import Agent, RunContext
from nowledge_mem_pydantic_ai import NowledgeIdentity, NowledgeMem


@dataclass(frozen=True)
class RequestIdentity:
    agent_id: str
    space_id: str


def identity(ctx: RunContext[RequestIdentity]) -> NowledgeIdentity:
    return NowledgeIdentity(
        agent_id=ctx.deps.agent_id,
        space_id=ctx.deps.space_id,
    )


agent = Agent(
    os.environ["PYDANTIC_AI_MODEL"],
    deps_type=RequestIdentity,
    capabilities=[NowledgeMem(identity=identity)],
)
```

The callback runs once per run, before network access. Its result is frozen for
context, MCP discovery/calls, and capture. Model-supplied `agent_id`,
`host_agent_id`, `space_id`, and `source_app` arguments cannot override it.
Never derive these selectors from a user prompt or model output.

Identity headers are selectors, **not authorization**. Mem enforces access using
the connection's credentials. Use separate configured clients for separate
credential principals; changing `space_id` does not switch credentials.

## Opt-in conversation capture

```python
import asyncio
import os

from pydantic_ai import Agent
from nowledge_mem_pydantic_ai import NowledgeMem, NowledgeSettings


async def main() -> None:
    settings = NowledgeSettings.from_env(
        application_id="support-assistant",
        sync_threads=True,
    )
    agent = Agent(
        os.environ["PYDANTIC_AI_MODEL"],
        capabilities=[NowledgeMem(settings=settings)],
    )
    first = await agent.run("We chose bounded retries.", conversation_id="ticket-42")
    second = await agent.run(
        "Why did we choose that?",
        message_history=first.all_messages(),
    )
    print(second.output)


asyncio.run(main())
```

Alternatively set `NMEM_PYDANTIC_AI_SYNC_THREADS=true` and a stable
`NMEM_PYDANTIC_AI_APP_ID`. Your application should supply stable, unique
`conversation_id` values and keep each conversation in one Space. If omitted,
Pydantic AI generates the conversation ID. Reusing its native message history
continues that conversation.

The Thread ID is namespaced by application, configured Space, and conversation.
Different explicit Spaces cannot relocate the same local Thread. The client
keeps at most 256 acknowledged cursors. Subsequent imports send only the new
suffix with the server's acknowledged message count and an idempotency key.
Checkpoint conflicts trigger at most one full-snapshot reconciliation. Failed
imports never advance the cursor.

Keep full native history in your application's storage to reconcile after a
restart or cursor eviction. `ModelMessagesTypeAdapter` JSON round trips preserve
the adapter's context markers. This adapter does not own a checkpoint database,
delete remote history, or promise exact replay after lossy history conversion.
Serialize writes to the same conversation; concurrent distinct conversations
and Spaces are supported.

Capture includes user text, assistant text, and accepted structured output-tool
arguments. Pydantic AI's default accepted-output acknowledgement is checked;
rejected or skipped output attempts are omitted. Custom output-return text and
application transformations of structured results are outside that capture
contract. Capture excludes system prompts, injected Mem context, reasoning,
ordinary tool calls/results, and binary attachments. An assistant's visible
answer may naturally quote retrieved knowledge.

The configured Mem token and common credential assignments are redacted before
upload. This is best-effort redaction, not a general data-loss-prevention system.
Each message is capped at 16 KiB by default and marked when truncated. Histories
over 2,000 normalized messages fail capture visibly instead of silently losing
the oldest messages. Failed or cancelled agent runs do not trigger automatic
capture. Capture can be interrupted too; the next completed run can reconcile
using its full history.

## Design and failure boundaries

- A `for_run` capability/toolset owns its MCP connection, identity, context, and
  structured-output tracking. No mutable global run state is shared.
- Context is a bounded, transient user-content block before the current run's
  messages. Host system instructions retain precedence. Previous injected
  blocks are replaced using `TextContent.metadata`, including after native
  history serialization; user-written lookalike text is preserved.
- Context refresh happens once per run, not once per model/tool step. Normal
  retrieval remains model-driven through the server's tools.
- Context-read and capture failures log a sanitized warning and preserve the
  model result by default. Set `fail_open=False` to make them fatal. Scope
  mismatches and REST 4xx responses other than 408/429 always fail closed. MCP discovery and
  tool failures remain visible through Pydantic AI's normal error/retry handling.
- `NowledgeClient(http_client=...)` borrows a caller-owned `httpx.AsyncClient`
  for REST only. The caller owns its lifetime and event loop. Without injection,
  REST requests own their connections; MCP connections are always run-owned.
- The connector does not supply a model, replace Pydantic AI history storage,
  or add a Mem backend endpoint. Both REST context/import and streamable HTTP
  MCP must be available on the selected server.

Settings also expose `include_context`, `timeout_seconds`, `max_context_bytes`,
`max_message_bytes`, and `max_sync_messages`. Defaults are 8 seconds, 8,000 bytes
of Context Bundle text, 16 KiB per captured message, and 2,000 captured messages.

The capability/toolset split is inspired by
[PowerContext's Pydantic AI integration](https://github.com/oceanbase/powercontext/blob/3738c586f5c8d84f9256d1fa71624f7797266bc9/docs/en/docs/integrations/pydantic-ai.md).
Mem's implementation reuses its existing MCP and REST contracts.

## Development and validation

```bash
cd nowledge-mem-pydantic-ai
python -m pip install '.[dev]'
python -m ruff check .
python -m ruff format --check .
python -m pyright --project pyproject.toml --pythonpath "$(python -c 'import sys; print(sys.executable)')"
python -m pytest
python -m build
```

Tests use real Pydantic AI `Agent` / `FunctionModel` execution and its MCP client
against a loopback MCP/REST fixture. They need no model key or customer data.
They cover scoped tool calls, parallel runs, context replacement, native JSON
history, structured-output retries, cancellation, sync entrypoints, redaction,
acknowledgement failures, bounded reconciliation, and restart replay. CI also
checks formatting, types, and package builds across Linux, macOS, and Windows.
These fixtures do not qualify a live Mem deployment or a specific model provider.
