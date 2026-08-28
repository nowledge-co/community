from __future__ import annotations

from typing import Any, cast

import httpx
import pytest
from langchain.agents.middleware.types import ModelRequest, ModelResponse
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_mcp_adapters.interceptors import MCPToolCallRequest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph
from langgraph.runtime import ExecutionInfo, Runtime, ServerInfo
from typing_extensions import TypedDict

from nowledge_mem_langgraph import (
    NowledgeClient,
    NowledgeIdentity,
    NowledgeMiddleware,
    NowledgeSettings,
)
from nowledge_mem_langgraph.messages import (
    NOWLEDGE_TOOL_NAMES,
    normalize_messages,
    select_acknowledged_delta,
)


class ProbeState(TypedDict):
    value: str


def test_feedback_loop_guard_covers_external_agent_tool_contract() -> None:
    assert {
        "read_context_bundle",
        "read_working_memory",
        "memory_search",
        "get_memory_by_id",
        "memory_add",
        "memory_update",
        "thread_search",
        "thread_fetch_messages",
        "mem_fs",
        "find_skills",
        "report_skill_outcome",
        "list_timeline_reviews",
        "resolve_timeline_review",
        "memory_evolves_revise",
        "check_claims",
        "trigger_memory_catchup",
    } == NOWLEDGE_TOOL_NAMES


def runtime(
    *,
    context: object | None = None,
    thread_id: str | None = "thread-7",
    checkpoint_ns: str = "",
    assistant_id: str = "assistant-v2",
    run_id: str = "run-1",
) -> Runtime[Any]:
    return Runtime(
        context=context,
        execution_info=ExecutionInfo(
            checkpoint_id="checkpoint-1",
            checkpoint_ns=checkpoint_ns,
            task_id="task-1",
            thread_id=thread_id,
            run_id=run_id,
        ),
        server_info=ServerInfo(assistant_id=assistant_id, graph_id="support"),
    )


@pytest.mark.parametrize(
    ("mcp_url", "expected"),
    [
        (None, "http://mem.test/mcp"),
        ("https://cloud.nowledge.co/mcp/", "https://cloud.nowledge.co/mcp"),
    ],
)
def test_settings_normalize_mcp_url_without_trailing_slash(
    mcp_url: str | None, expected: str
) -> None:
    settings = NowledgeSettings(api_url="http://mem.test/", mcp_url=mcp_url).normalized()

    assert settings.mcp_url == expected


def test_runtime_identity_is_atomic_and_server_identity_is_only_host_provenance() -> None:
    settings = NowledgeSettings(
        identity=NowledgeIdentity(
            agent_id="static-agent", host_agent_id="static-host", space_id="default-space"
        )
    )
    selected = settings.resolve_identity(
        runtime(context={"nowledge": {"agent_id": "runtime-agent", "space_id": "ticket"}})
    )
    assert selected == NowledgeIdentity(
        agent_id="runtime-agent",
        host_agent_id="langgraph:support:assistant-v2",
        space_id="ticket",
    )
    assert settings.resolve_identity(runtime()).agent_id == "static-agent"
    assert settings.resolve_identity(runtime()).host_agent_id == "static-host"


@pytest.mark.asyncio
async def test_mcp_interceptor_overrides_model_scope_and_keeps_auth_separate() -> None:
    settings = NowledgeSettings(
        api_key="secret",
        identity=NowledgeIdentity(agent_id="trusted", space_id="allowed"),
    ).normalized()
    client = NowledgeClient(settings)
    captured: MCPToolCallRequest | None = None

    async def handler(request: MCPToolCallRequest) -> str:
        nonlocal captured
        captured = request
        return "ok"

    request = MCPToolCallRequest(
        name="memory_search",
        args={"query": "roadmap", "agent_id": "attacker", "space_id": "other"},
        server_name="nowledge-mem",
        headers={"Existing": "yes"},
        runtime=runtime(),
    )
    assert await client._scope_tool_call(request, handler) == "ok"
    assert captured is not None
    assert captured.args["agent_id"] == "trusted"
    assert captured.args["space_id"] == "allowed"
    assert captured.headers == {
        "Existing": "yes",
        "Authorization": "Bearer secret",
        "App": "langgraph",
        "X-Nmem-Tool-Set": "external-agent",
        "X-Nowledge-Tool-Schema-Profile": "slim",
        "X-Nmem-Agent-Id": "trusted",
        "X-Nmem-Host-Agent-Id": "langgraph:support:assistant-v2",
        "X-Nmem-Space-Id": "allowed",
    }


@pytest.mark.asyncio
async def test_runtime_host_only_identity_removes_static_agent_header() -> None:
    settings = NowledgeSettings(
        identity=NowledgeIdentity(agent_id="static-agent", host_agent_id="static-host")
    ).normalized()
    client = NowledgeClient(settings)
    captured: MCPToolCallRequest | None = None

    async def handler(request: MCPToolCallRequest) -> str:
        nonlocal captured
        captured = request
        return "ok"

    scoped_runtime = runtime(context={"nowledge": {"host_agent_id": "runtime-host"}})
    request = MCPToolCallRequest(
        name="memory_search",
        args={"query": "roadmap", "agent_id": "model-agent"},
        server_name="nowledge-mem",
        headers={
            "X-Nmem-Agent-Id": "static-agent",
            "X-Nmem-Host-Agent-Id": "static-host",
        },
        runtime=scoped_runtime,
    )
    assert await client._scope_tool_call(request, handler) == "ok"
    assert captured is not None
    assert "agent_id" not in captured.args
    assert "X-Nmem-Agent-Id" not in captured.headers
    assert captured.headers["X-Nmem-Host-Agent-Id"] == "runtime-host"


def test_thread_payload_uses_thread_not_assistant_and_excludes_mem_tool_output() -> None:
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "success": True,
                "failed_count": 0,
                "results": [
                    {"success": True, "append_mode": "created", "message_count": 4}
                ],
            },
            request=request,
        )

    transport = httpx.MockTransport(handle)
    http = httpx.Client(base_url="http://mem.test", transport=transport)
    client = NowledgeClient(
        NowledgeSettings(api_url="http://mem.test", application_id="support"), client=http
    )
    messages = [
        HumanMessage(content="Help me", id="human-1"),
        AIMessage(
            content="",
            id="ai-1",
            tool_calls=[{"name": "memory_search", "args": {"query": "x"}, "id": "call-1"}],
        ),
        ToolMessage(content="old private context", tool_call_id="call-1", id="tool-1"),
        AIMessage(content="Here is the answer", id="ai-2"),
    ]
    client.sync_thread(thread_id="ticket-4", messages=messages, runtime=runtime())

    payload = __import__("json").loads(requests[0].content)
    assert payload["thread_id"] == "langgraph:support:ticket-4"
    assert "assistant-v2" not in payload["thread_id"]
    assert payload["metadata"]["langgraph"]["assistant_id"] == "assistant-v2"
    tool = payload["messages"][2]
    assert tool["metadata"]["exclude_from_distillation"] is True
    assert tool["metadata"]["external_context_source"] == "nowledge-mem"


def test_fallback_message_ids_are_deterministic_and_distinguish_repeats() -> None:
    messages = [HumanMessage(content="same"), HumanMessage(content="same")]
    first = normalize_messages(messages)
    second = normalize_messages(messages)
    assert first == second
    assert first[0]["metadata"]["external_id"] != first[1]["metadata"]["external_id"]


@pytest.mark.parametrize(
    "response",
    [
        {},
        {"success": False, "failed_count": 0, "results": [{"success": True}]},
        {"success": True, "failed_count": 0, "results": []},
    ],
)
def test_thread_sync_requires_explicit_successful_result(response: object) -> None:
    with pytest.raises(RuntimeError):
        NowledgeClient._validate_thread_sync_ack(response, None)


def test_acknowledged_delta_resets_when_compaction_replaces_anchor() -> None:
    original = normalize_messages(
        [HumanMessage(content="first", id="h1"), AIMessage(content="answer", id="a1")]
    )
    cursor = select_acknowledged_delta(original, None)[1]
    compacted = normalize_messages(
        [HumanMessage(content="replacement", id="h2"), AIMessage(content="new", id="a2")]
    )
    delta, next_cursor, reset = select_acknowledged_delta(compacted, cursor)
    assert delta == compacted
    assert next_cursor[0:2] == (2, "langgraph:a2")
    assert reset is True


def test_acknowledged_delta_resets_when_earlier_content_changes() -> None:
    original = normalize_messages(
        [HumanMessage(content="old", id="h1"), AIMessage(content="same", id="a1")]
    )
    cursor = select_acknowledged_delta(original, None)[1]
    changed = normalize_messages(
        [HumanMessage(content="new", id="h1"), AIMessage(content="same", id="a1")]
    )
    delta, _, reset = select_acknowledged_delta(changed, cursor)
    assert delta == changed
    assert reset is True


def test_acknowledged_delta_accepts_legacy_three_field_cursor() -> None:
    messages = normalize_messages(
        [HumanMessage(content="first", id="h1"), AIMessage(content="answer", id="a1")]
    )
    cursor = select_acknowledged_delta(messages, None)[1]
    delta, next_cursor, reset = select_acknowledged_delta(messages, cursor[:3])
    assert delta == []
    assert next_cursor[3] == len(messages)
    assert reset is False


def test_thread_sync_uploads_only_acknowledged_delta_and_retries_after_failure() -> None:
    requests: list[dict[str, Any]] = []
    statuses = iter([200, 500, 200])

    def handle(request: httpx.Request) -> httpx.Response:
        body = __import__("json").loads(request.content)
        requests.append(body)
        status = next(statuses)
        result = {
            "success": True,
            "failed_count": 0,
            "results": [
                {
                    "success": True,
                    "message_count": len(body["messages"])
                    + int(body.get("expected_message_count", 0)),
                    **(
                        {"append_mode": "checkpointed"}
                        if "expected_message_count" in body
                        else {"append_mode": "created"}
                    ),
                }
            ],
        }
        return httpx.Response(status, json=result, request=request)

    http = httpx.Client(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    middleware = NowledgeMiddleware(
        NowledgeClient(NowledgeSettings(api_url="http://mem.test"), client=http)
    )
    first = [HumanMessage(content="hello", id="h1"), AIMessage(content="one", id="a1")]
    second = [*first, HumanMessage(content="next", id="h2"), AIMessage(content="two", id="a2")]

    middleware.after_agent({"messages": first}, runtime())
    middleware.after_agent({"messages": second}, runtime())
    middleware.after_agent({"messages": second}, runtime())

    assert [
        [message["metadata"]["external_id"] for message in body["messages"]] for body in requests
    ] == [
        ["langgraph:h1", "langgraph:a1"],
        ["langgraph:h2", "langgraph:a2"],
        ["langgraph:h2", "langgraph:a2"],
    ]
    assert [body.get("expected_message_count") for body in requests] == [None, 2, 2]


def test_thread_sync_keeps_cursor_after_http_200_semantic_failure() -> None:
    requests: list[dict[str, Any]] = []
    responses = iter(["created", "failed", "checkpointed"])

    def handle(request: httpx.Request) -> httpx.Response:
        body = __import__("json").loads(request.content)
        requests.append(body)
        outcome = next(responses)
        if outcome == "failed":
            result = {
                "failed_count": 0,
                "results": [
                    {"success": True, "append_mode": "checkpointed", "message_count": 4}
                ],
            }
        else:
            result = {
                "success": True,
                "failed_count": 0,
                "results": [
                    {
                        "success": True,
                        "append_mode": outcome,
                        "message_count": len(body["messages"])
                        + int(body.get("expected_message_count", 0)),
                    }
                ],
            }
        return httpx.Response(200, json=result, request=request)

    http = httpx.Client(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    middleware = NowledgeMiddleware(
        NowledgeClient(NowledgeSettings(api_url="http://mem.test"), client=http)
    )
    first = [HumanMessage(content="hello", id="h1"), AIMessage(content="one", id="a1")]
    second = [*first, HumanMessage(content="next", id="h2"), AIMessage(content="two", id="a2")]

    middleware.after_agent({"messages": first}, runtime())
    middleware.after_agent({"messages": second}, runtime())
    middleware.after_agent({"messages": second}, runtime())

    assert requests[1]["messages"] == requests[2]["messages"]
    assert requests[1]["expected_message_count"] == 2
    assert requests[2]["expected_message_count"] == 2


def test_thread_sync_reconciles_typed_checkpoint_conflict_and_uses_remote_count() -> None:
    requests: list[dict[str, Any]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        body = __import__("json").loads(request.content)
        requests.append(body)
        index = len(requests)
        if index == 2:
            response = {
                "success": False,
                "failed_count": 1,
                "results": [
                    {
                        "success": False,
                        "error_code": "checkpoint_conflict",
                        "error": "remote count moved",
                    }
                ],
            }
        else:
            response = {
                "success": True,
                "failed_count": 0,
                "results": [
                    {
                        "success": True,
                        "append_mode": (
                            "checkpointed" if "expected_message_count" in body else "deduplicated"
                        ),
                        "message_count": {1: 2, 3: 5, 4: 7}[index],
                    }
                ],
            }
        return httpx.Response(200, json=response, request=request)

    http = httpx.Client(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    middleware = NowledgeMiddleware(
        NowledgeClient(NowledgeSettings(api_url="http://mem.test"), client=http)
    )
    first = [HumanMessage(content="hello", id="h1"), AIMessage(content="one", id="a1")]
    second = [*first, HumanMessage(content="next", id="h2"), AIMessage(content="two", id="a2")]
    third = [*second, HumanMessage(content="again", id="h3"), AIMessage(content="three", id="a3")]

    middleware.after_agent({"messages": first}, runtime())
    middleware.after_agent({"messages": second}, runtime())
    middleware.after_agent({"messages": third}, runtime())

    assert [len(body["messages"]) for body in requests] == [2, 2, 4, 2]
    assert [body.get("expected_message_count") for body in requests] == [None, 2, None, 5]


@pytest.mark.asyncio
async def test_async_thread_sync_keeps_cursor_after_http_200_semantic_failure() -> None:
    requests: list[dict[str, Any]] = []
    responses = iter(["created", "failed", "checkpointed"])

    async def handle(request: httpx.Request) -> httpx.Response:
        body = __import__("json").loads(request.content)
        requests.append(body)
        outcome = next(responses)
        if outcome == "failed":
            result = {
                "success": False,
                "failed_count": 1,
                "results": [{"success": False, "error": "rejected"}],
            }
        else:
            result = {
                "success": True,
                "failed_count": 0,
                "results": [
                    {
                        "success": True,
                        "append_mode": outcome,
                        "message_count": len(body["messages"])
                        + int(body.get("expected_message_count", 0)),
                    }
                ],
            }
        return httpx.Response(200, json=result, request=request)

    http = httpx.AsyncClient(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    middleware = NowledgeMiddleware(
        NowledgeClient(NowledgeSettings(api_url="http://mem.test"), async_client=http)
    )
    first = [HumanMessage(content="hello", id="h1"), AIMessage(content="one", id="a1")]
    second = [*first, HumanMessage(content="next", id="h2"), AIMessage(content="two", id="a2")]

    await middleware.aafter_agent({"messages": first}, runtime())
    await middleware.aafter_agent({"messages": second}, runtime())
    await middleware.aafter_agent({"messages": second}, runtime())

    assert requests[1]["messages"] == requests[2]["messages"]
    assert requests[1]["expected_message_count"] == 2
    assert requests[2]["expected_message_count"] == 2
    await http.aclose()


@pytest.mark.asyncio
async def test_async_thread_sync_reconciles_checkpoint_conflict() -> None:
    requests: list[dict[str, Any]] = []

    async def handle(request: httpx.Request) -> httpx.Response:
        body = __import__("json").loads(request.content)
        requests.append(body)
        index = len(requests)
        if index == 2:
            response = {
                "success": False,
                "failed_count": 1,
                "results": [{"success": False, "error_code": "checkpoint_conflict"}],
            }
        else:
            response = {
                "success": True,
                "failed_count": 0,
                "results": [
                    {
                        "success": True,
                        "append_mode": (
                            "checkpointed" if "expected_message_count" in body else "deduplicated"
                        ),
                        "message_count": {1: 2, 3: 5, 4: 7}[index],
                    }
                ],
            }
        return httpx.Response(200, json=response, request=request)

    http = httpx.AsyncClient(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    middleware = NowledgeMiddleware(
        NowledgeClient(NowledgeSettings(api_url="http://mem.test"), async_client=http)
    )
    first = [HumanMessage(content="hello", id="h1"), AIMessage(content="one", id="a1")]
    second = [*first, HumanMessage(content="next", id="h2"), AIMessage(content="two", id="a2")]
    third = [*second, HumanMessage(content="again", id="h3"), AIMessage(content="three", id="a3")]

    await middleware.aafter_agent({"messages": first}, runtime())
    await middleware.aafter_agent({"messages": second}, runtime())
    await middleware.aafter_agent({"messages": third}, runtime())

    assert [len(body["messages"]) for body in requests] == [2, 2, 4, 2]
    assert [body.get("expected_message_count") for body in requests] == [None, 2, None, 5]
    await http.aclose()


def test_thread_cursor_isolated_by_destination_identity() -> None:
    requests: list[dict[str, Any]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(__import__("json").loads(request.content))
        return httpx.Response(
            200,
            json={
                "success": True,
                "failed_count": 0,
                "results": [{"success": True, "append_mode": "created"}],
            },
            request=request,
        )

    http = httpx.Client(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    middleware = NowledgeMiddleware(
        NowledgeClient(NowledgeSettings(api_url="http://mem.test"), client=http)
    )
    state = {
        "messages": [
            HumanMessage(content="hello", id="h1"),
            AIMessage(content="answer", id="a1"),
        ]
    }

    middleware.after_agent(
        state,
        runtime(context={"nowledge": {"agent_id": "agent-a", "space_id": "shared"}}),
    )
    middleware.after_agent(
        state,
        runtime(context={"nowledge": {"agent_id": "agent-b", "space_id": "shared"}}),
    )

    assert [body["metadata"]["agent_id"] for body in requests] == ["agent-a", "agent-b"]


def test_sync_middleware_injects_context_once_per_turn_and_syncs_top_level() -> None:
    calls: list[tuple[str, dict[str, Any]]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        body = __import__("json").loads(request.content) if request.content else {}
        calls.append((request.url.path, body))
        if request.url.path == "/context/bundle":
            return httpx.Response(200, json={"rendered_markdown": "## Working Memory\nShip it"})
        return httpx.Response(
            200,
            json={
                "success": True,
                "failed_count": 0,
                "results": [{"success": True, "append_mode": "created"}],
            },
        )

    http = httpx.Client(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    client = NowledgeClient(NowledgeSettings(api_url="http://mem.test"), client=http)
    middleware = NowledgeMiddleware(client)
    request = ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=[HumanMessage(content="hello", id="h1")],
        runtime=runtime(),
    )

    def model_handler(scoped: ModelRequest[Any]) -> ModelResponse[Any]:
        assert scoped.system_message is not None
        assert "Ship it" in scoped.system_message.text
        return ModelResponse(result=[AIMessage(content="ok")])

    middleware.wrap_model_call(request, model_handler)
    middleware.wrap_model_call(request, model_handler)
    middleware.after_agent(
        {"messages": [HumanMessage(content="hello"), AIMessage(content="ok")]}, runtime()
    )
    assert [path for path, _ in calls].count("/context/bundle") == 1
    assert [path for path, _ in calls].count("/threads/import") == 1


def test_context_cache_refreshes_for_a_new_run_with_repeated_user_text() -> None:
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"rendered_markdown": f"bundle-{calls}"})

    http = httpx.Client(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    middleware = NowledgeMiddleware(
        NowledgeClient(NowledgeSettings(api_url="http://mem.test"), client=http)
    )

    def invoke_for(run_id: str) -> None:
        request = ModelRequest(
            model=FakeListChatModel(responses=["ok"]),
            messages=[HumanMessage(content="same question")],
            runtime=runtime(run_id=run_id),
        )
        middleware.wrap_model_call(request, lambda _: ModelResponse(result=[]))

    invoke_for("run-1")
    invoke_for("run-1")
    invoke_for("run-2")
    assert calls == 2


def test_nested_subgraph_and_stateless_runs_do_not_create_duplicate_threads() -> None:
    class TrapClient(NowledgeClient):
        def sync_thread(self, **kwargs: Any) -> Any:
            raise AssertionError("nested/stateless run must not sync")

    middleware = NowledgeMiddleware(TrapClient(NowledgeSettings()))
    state = {"messages": [HumanMessage(content="hello")]}
    middleware.after_agent(state, runtime(checkpoint_ns="parent:node|child:node"))
    middleware.after_agent(state, runtime(thread_id=None))


def test_current_langgraph_runtime_marks_child_namespace_with_separator() -> None:
    middleware = NowledgeMiddleware(NowledgeClient(NowledgeSettings()))
    observed: list[tuple[str, bool]] = []

    def child_node(state: ProbeState, runtime: Runtime[Any]) -> ProbeState:
        observed.append(("child", middleware._is_nested(runtime)))
        return {"value": "child"}

    child = (
        StateGraph(ProbeState)
        .add_node("child_node", child_node)
        .add_edge(START, "child_node")
        .compile()
    )

    def parent_node(state: ProbeState, runtime: Runtime[Any]) -> ProbeState:
        observed.append(("parent", middleware._is_nested(runtime)))
        return cast(ProbeState, child.invoke(state))

    parent = (
        StateGraph(ProbeState)
        .add_node("parent_node", parent_node)
        .add_edge(START, "parent_node")
        .compile(checkpointer=InMemorySaver())
    )
    parent.invoke({"value": "start"}, config={"configurable": {"thread_id": "probe"}})

    assert observed == [("parent", False), ("child", True)]


@pytest.mark.asyncio
async def test_async_middleware_uses_async_context_and_thread_paths() -> None:
    paths: list[str] = []

    async def handle(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        body = (
            {"rendered_markdown": "async context"} if request.url.path == "/context/bundle" else {}
        )
        return httpx.Response(200, json=body, request=request)

    http = httpx.AsyncClient(base_url="http://mem.test", transport=httpx.MockTransport(handle))
    client = NowledgeClient(NowledgeSettings(api_url="http://mem.test"), async_client=http)
    middleware = NowledgeMiddleware(client)
    request = ModelRequest(
        model=FakeListChatModel(responses=["ok"]),
        messages=[HumanMessage(content="hello", id="async-h1")],
        runtime=runtime(),
    )

    async def model_handler(scoped: ModelRequest[Any]) -> ModelResponse[Any]:
        assert scoped.system_message is not None
        assert "async context" in scoped.system_message.text
        return ModelResponse(result=[AIMessage(content="ok")])

    await middleware.awrap_model_call(request, model_handler)
    await middleware.aafter_agent(
        {"messages": [HumanMessage(content="hello"), AIMessage(content="ok")]}, runtime()
    )
    assert paths == ["/context/bundle", "/threads/import"]
    await http.aclose()
