from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from conftest import MemServer
from pydantic import BaseModel, SecretStr
from pydantic_ai import Agent, RunContext
from pydantic_ai.exceptions import UnexpectedModelBehavior
from pydantic_ai.messages import (
    ModelMessage,
    ModelMessagesTypeAdapter,
    ModelResponse,
    RetryPromptPart,
    TextContent,
    TextPart,
    ThinkingPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel

from nowledge_mem_pydantic_ai import (
    NowledgeIdentity,
    NowledgeMem,
    NowledgeScopeError,
    NowledgeToolset,
)
from nowledge_mem_pydantic_ai.messages import is_context


def search_then_answer(messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
    if isinstance(messages[-1].parts[-1], ToolReturnPart):
        return ModelResponse(parts=[TextPart("visible answer")])
    return ModelResponse(
        parts=[
            ToolCallPart(
                "memory_search",
                {"query": "decision", "space_id": "model-space", "agent_id": "model-agent"},
                "search-1",
            )
        ]
    )


async def test_tool_only_uses_server_schema_and_host_scope(mem_server: MemServer) -> None:
    seen = []

    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        seen.extend(tool.name for tool in info.function_tools)
        return search_then_answer(messages, info)

    settings = mem_server.settings(
        api_key=SecretStr("synthetic-token"),
        identity=NowledgeIdentity(agent_id="host-agent", space_id="host-space"),
    )
    agent = Agent(FunctionModel(respond), toolsets=[NowledgeToolset(settings=settings)])
    result = await agent.run("Look up a decision")
    assert result.output == "visible answer"
    assert "memory_search" in seen
    calls = [r for r in mem_server.requests if r["kind"] == "tools/call"]
    assert calls[0]["payload"]["params"]["arguments"] == {
        "query": "decision",
        "space_id": "host-space",
        "agent_id": "host-agent",
    }
    for request in mem_server.requests:
        assert request["headers"]["X-Nmem-Space-Id"] == "host-space"
        assert request["headers"]["Authorization"] == "Bearer synthetic-token"
    assert not mem_server.imports
    assert not any(r["kind"] == "context" for r in mem_server.requests)


async def test_context_refreshes_once_per_run_without_history_growth(mem_server: MemServer) -> None:
    observed: list[list[str]] = []

    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        observed.append(
            [
                content.content
                for message in messages
                for part in message.parts
                if isinstance(part, UserPromptPart) and not isinstance(part.content, str)
                for content in part.content
                if isinstance(content, TextContent) and is_context(content)
            ]
        )
        return search_then_answer(messages, info)

    agent = Agent(
        FunctionModel(respond), capabilities=[NowledgeMem(settings=mem_server.settings())]
    )
    first = await agent.run("First turn")
    before = first.all_messages_json()
    mem_server.context = "context-two"
    second = await agent.run("Second turn", message_history=first.all_messages())
    assert first.all_messages_json() == before
    assert second.output == "visible answer"
    assert len(observed) == 4
    assert all(len(contexts) == 1 for contexts in observed), observed
    assert all("context-one" in row[0] for row in observed[:2])
    assert all("context-two" in row[0] and "context-one" not in row[0] for row in observed[2:])
    assert len([r for r in mem_server.requests if r["kind"] == "context"]) == 2
    assert not mem_server.imports


async def test_parallel_runs_resolve_identity_once_and_do_not_cross_scope(
    mem_server: MemServer,
) -> None:
    resolutions: list[str] = []

    def identity(ctx: RunContext[dict[str, str]]) -> NowledgeIdentity:
        resolutions.append(ctx.deps["space"])
        return NowledgeIdentity(agent_id=ctx.deps["space"], space_id=ctx.deps["space"])

    agent = Agent(
        FunctionModel(search_then_answer),
        deps_type=dict[str, str],
        capabilities=[NowledgeMem(settings=mem_server.settings(), identity=identity)],
    )
    await asyncio.gather(
        agent.run("Alpha", deps={"space": "alpha"}),
        agent.run("Beta", deps={"space": "beta"}),
    )
    assert sorted(resolutions) == ["alpha", "beta"]
    contexts = [r for r in mem_server.requests if r["kind"] == "context"]
    calls = [r for r in mem_server.requests if r["kind"] == "tools/call"]
    assert {r["query"]["space_id"][0] for r in contexts} == {"alpha", "beta"}
    for call in calls:
        assert (
            call["payload"]["params"]["arguments"]["space_id"] == call["headers"]["X-Nmem-Space-Id"]
        )


async def test_capture_syncs_only_visible_messages_and_acknowledged_suffix(
    mem_server: MemServer,
) -> None:
    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        response = search_then_answer(messages, info)
        response.parts = [ThinkingPart("hidden-reasoning-sentinel"), *response.parts]
        return response

    settings = mem_server.settings(sync_threads=True, application_id="support")
    agent = Agent(FunctionModel(respond), capabilities=[NowledgeMem(settings=settings)])
    first = await agent.run("First turn", conversation_id="ticket-42")
    await agent.run("Second turn", message_history=first.all_messages())
    assert len(mem_server.imports) == 2
    first_payload, second_payload = mem_server.imports
    assert first_payload["thread_id"] == second_payload["thread_id"]
    assert [m["content"] for m in first_payload["messages"]] == ["First turn", "visible answer"]
    assert [m["content"] for m in second_payload["messages"]] == ["Second turn", "visible answer"]
    assert second_payload["expected_message_count"] == 2
    assert second_payload["idempotency_key"]
    captured = json.dumps(mem_server.imports)
    for forbidden in (
        "hidden-reasoning-sentinel",
        "recalled-memory-not-new-evidence",
        "context-one",
    ):
        assert forbidden not in captured
    assert len(next(iter(mem_server.threads.values()))) == 4


async def test_structured_final_answer_is_captured_without_tool_trace(
    mem_server: MemServer,
) -> None:
    class Answer(BaseModel):
        decision: str

    def respond(_messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {"decision": "ship"})])

    settings = mem_server.settings(sync_threads=True, application_id="structured")
    agent = Agent(
        FunctionModel(respond), output_type=Answer, capabilities=[NowledgeMem(settings=settings)]
    )
    result = await agent.run("Choose")
    assert result.output.decision == "ship"
    assert json.loads(mem_server.imports[0]["messages"][-1]["content"]) == {"decision": "ship"}


async def test_unavailable_context_is_attempted_once_and_reports_failure(
    mem_server: MemServer,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mem_server.context_status = 503
    agent = Agent(
        FunctionModel(search_then_answer),
        capabilities=[NowledgeMem(settings=mem_server.settings())],
    )
    assert (await agent.run("Proceed")).output == "visible answer"
    assert len([r for r in mem_server.requests if r["kind"] == "context"]) == 1
    assert "context read failed" in caplog.text


@pytest.mark.parametrize("status", [400, 401, 403, 404, 422])
async def test_scope_and_auth_errors_do_not_fall_back(mem_server: MemServer, status: int) -> None:
    mem_server.context_status = status
    agent = Agent(
        FunctionModel(search_then_answer),
        capabilities=[NowledgeMem(settings=mem_server.settings())],
    )
    with pytest.raises(RuntimeError, match="rejected"):
        await agent.run("Denied")
    assert not any(r["kind"] == "tools/call" for r in mem_server.requests)
    assert not mem_server.imports


async def test_context_that_falls_back_to_another_space_is_rejected(mem_server: MemServer) -> None:
    mem_server.resolved_space = "default"
    agent = Agent(
        FunctionModel(search_then_answer),
        capabilities=[
            NowledgeMem(
                settings=mem_server.settings(identity=NowledgeIdentity(space_id="unknown-space")),
            )
        ],
    )
    with pytest.raises(NowledgeScopeError, match="selected Space"):
        await agent.run("Use the explicit Space")
    assert not any(r["kind"] == "tools/call" for r in mem_server.requests)
    assert not mem_server.imports


async def test_tool_failure_is_visible_to_the_model(mem_server: MemServer) -> None:
    mem_server.tool_error = True
    agent = Agent(
        FunctionModel(search_then_answer),
        toolsets=[NowledgeToolset(settings=mem_server.settings())],
        retries=0,
    )
    with pytest.raises(UnexpectedModelBehavior, match="retries"):
        await agent.run("Search")


async def test_invalid_identity_callback_fails_before_network(mem_server: MemServer) -> None:
    def invalid(_ctx: RunContext[Any]) -> Any:
        return None

    agent = Agent(
        FunctionModel(search_then_answer),
        toolsets=[NowledgeToolset(settings=mem_server.settings(), identity=invalid)],
    )
    with pytest.raises(TypeError, match="NowledgeIdentity"):
        await agent.run("Search")
    assert not mem_server.requests


async def test_failed_import_is_visible_and_does_not_change_model_output(
    mem_server: MemServer,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mem_server.responses.append(
        {"success": True, "failed_count": 1, "results": [{"success": False}]}
    )
    agent = Agent(
        FunctionModel(search_then_answer),
        capabilities=[
            NowledgeMem(
                settings=mem_server.settings(sync_threads=True, application_id="failure"),
            )
        ],
    )
    assert (await agent.run("Question")).output == "visible answer"
    assert "thread sync failed" in caplog.text


async def test_disabled_context_cleans_serialized_history(mem_server: MemServer) -> None:
    agent = Agent(
        FunctionModel(search_then_answer),
        capabilities=[NowledgeMem(settings=mem_server.settings())],
    )
    first = await agent.run("First")
    history = ModelMessagesTypeAdapter.validate_json(first.all_messages_json())

    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        assert "context-one" not in ModelMessagesTypeAdapter.dump_json(messages).decode()
        return search_then_answer(messages, info)

    disabled = Agent(
        FunctionModel(respond),
        capabilities=[
            NowledgeMem(
                settings=mem_server.settings(include_context=False),
            )
        ],
    )
    await disabled.run("Second", message_history=history)
    assert len([r for r in mem_server.requests if r["kind"] == "context"]) == 1


async def test_rejected_structured_output_is_not_captured(mem_server: MemServer) -> None:
    class Answer(BaseModel):
        number: int

    attempts = 0

    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return ModelResponse(
                parts=[
                    ToolCallPart(
                        info.output_tools[0].name,
                        {"number": "invalid-output"},
                        "invalid",
                    )
                ]
            )
        assert any(isinstance(p, RetryPromptPart) for p in messages[-1].parts)
        return ModelResponse(
            parts=[ToolCallPart(info.output_tools[0].name, {"number": 42}, "valid")]
        )

    agent = Agent(
        FunctionModel(respond),
        output_type=Answer,
        capabilities=[
            NowledgeMem(
                settings=mem_server.settings(sync_threads=True, application_id="validated-output"),
            )
        ],
    )
    assert (await agent.run("Choose a number")).output.number == 42
    assert "invalid-output" not in json.dumps(mem_server.imports)
    assert json.loads(mem_server.imports[0]["messages"][-1]["content"]) == {"number": 42}


async def test_cancelled_run_does_not_capture(mem_server: MemServer) -> None:
    entered = asyncio.Event()

    async def respond(_messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
        entered.set()
        await asyncio.Event().wait()
        raise AssertionError("Unreachable")

    agent = Agent(
        FunctionModel(respond),
        capabilities=[
            NowledgeMem(
                settings=mem_server.settings(sync_threads=True, application_id="cancelled"),
            )
        ],
    )
    task = asyncio.create_task(agent.run("Unfinished"))
    await asyncio.wait_for(entered.wait(), timeout=5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert not mem_server.imports


async def test_strict_auxiliary_policy_stops_after_unavailable_context(
    mem_server: MemServer,
) -> None:
    mem_server.context_status = 503
    agent = Agent(
        FunctionModel(search_then_answer),
        capabilities=[
            NowledgeMem(
                settings=mem_server.settings(fail_open=False),
            )
        ],
    )
    with pytest.raises(RuntimeError, match="context read failed"):
        await agent.run("Strict")


def test_sync_entrypoint_can_reuse_connector(mem_server: MemServer) -> None:
    agent = Agent(
        FunctionModel(search_then_answer),
        capabilities=[
            NowledgeMem(
                settings=mem_server.settings(sync_threads=True, application_id="sync-entrypoint"),
            )
        ],
    )
    first = agent.run_sync("One", conversation_id="sync-chat")
    second = agent.run_sync("Two", message_history=first.all_messages())
    assert second.output == "visible answer"
    assert mem_server.imports[-1]["expected_message_count"] == 2
