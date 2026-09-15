from __future__ import annotations

import asyncio
from typing import Any

import httpx
import pytest
from conftest import MemServer

from nowledge_mem_pydantic_ai import NowledgeClient, NowledgeIdentity, NowledgeSyncError


def message(index: int) -> dict[str, Any]:
    return {"role": "user", "content": f"Turn {index}", "metadata": {"external_id": str(index)}}


async def test_failed_ack_does_not_advance_cursor(mem_server: MemServer) -> None:
    client = NowledgeClient(mem_server.settings(application_id="retry"))
    identity = NowledgeIdentity()
    mem_server.responses.append({"success": False, "results": [{"success": False}]})
    with pytest.raises(NowledgeSyncError):
        await client.sync_thread("chat", [message(1)], identity)
    await client.sync_thread("chat", [message(1)], identity)
    assert mem_server.imports[0] == mem_server.imports[1]
    await client.sync_thread("chat", [message(1), message(2)], identity)
    assert mem_server.imports[-1]["expected_message_count"] == 1
    assert mem_server.imports[-1]["messages"] == [message(2)]


@pytest.mark.parametrize("error", ["checkpoint_conflict", "thread_not_found"])
async def test_conflict_reconciles_once_with_stable_full_snapshot(
    mem_server: MemServer,
    error: str,
) -> None:
    client = NowledgeClient(mem_server.settings(application_id="reconcile"))
    identity = NowledgeIdentity()
    await client.sync_thread("chat", [message(1)], identity)
    mem_server.responses.append({"success": False, "results": [{"error_code": error}]})
    await client.sync_thread("chat", [message(1), message(2)], identity)
    assert len(mem_server.imports) == 3
    assert mem_server.imports[1]["messages"] == [message(2)]
    assert mem_server.imports[2]["messages"] == [message(1), message(2)]
    assert "expected_message_count" not in mem_server.imports[2]
    assert len({p["thread_id"] for p in mem_server.imports}) == 1
    await client.sync_thread("chat", [message(1), message(2)], identity)
    assert len(mem_server.imports) == 3


async def test_repeated_conflict_is_bounded_and_does_not_advance(mem_server: MemServer) -> None:
    client = NowledgeClient(mem_server.settings(application_id="bounded"))
    identity = NowledgeIdentity()
    await client.sync_thread("chat", [message(1)], identity)
    mem_server.responses.extend(
        [
            {"success": False, "results": [{"error_code": "checkpoint_conflict"}]},
            {"success": False, "results": [{"error_code": "checkpoint_conflict"}]},
        ]
    )
    with pytest.raises(NowledgeSyncError):
        await client.sync_thread("chat", [message(1), message(2)], identity)
    assert len(mem_server.imports) == 3
    await client.sync_thread("chat", [message(1), message(2)], identity)
    assert mem_server.imports[-1]["expected_message_count"] == 1


async def test_suffix_requires_checkpoint_ack_before_advancing(mem_server: MemServer) -> None:
    client = NowledgeClient(mem_server.settings(application_id="ack"))
    identity = NowledgeIdentity()
    await client.sync_thread("chat", [message(1)], identity)
    mem_server.responses.append(
        {"success": True, "results": [{"success": True, "message_count": 2}]}
    )
    with pytest.raises(NowledgeSyncError, match="checkpointed"):
        await client.sync_thread("chat", [message(1), message(2)], identity)
    await client.sync_thread("chat", [message(1), message(2)], identity)
    assert mem_server.imports[-1] == mem_server.imports[-2]


async def test_restart_and_history_edit_reconcile_without_duplicates(mem_server: MemServer) -> None:
    settings = mem_server.settings(application_id="restart")
    identity = NowledgeIdentity()
    await NowledgeClient(settings).sync_thread("chat", [message(1)], identity)
    restarted = NowledgeClient(settings)
    await restarted.sync_thread("chat", [message(1), message(2)], identity)
    assert "expected_message_count" not in mem_server.imports[-1]
    assert len(next(iter(mem_server.threads.values()))) == 2
    await restarted.sync_thread("chat", [message(2), message(3)], identity)
    assert "expected_message_count" not in mem_server.imports[-1]
    assert len(next(iter(mem_server.threads.values()))) == 3


async def test_same_conversation_in_different_spaces_has_distinct_thread_ids(
    mem_server: MemServer,
) -> None:
    client = NowledgeClient(mem_server.settings(application_id="spaces"))
    await asyncio.gather(
        *[
            client.sync_thread("chat", [message(1)], NowledgeIdentity(space_id=space))
            for space in ("alpha", "beta")
        ]
    )
    assert len({p["thread_id"] for p in mem_server.imports}) == 2
    assert {p["space_id"] for p in mem_server.imports} == {"alpha", "beta"}


async def test_size_limit_fails_without_silently_truncating_history(mem_server: MemServer) -> None:
    client = NowledgeClient(mem_server.settings(application_id="bounded", max_sync_messages=1))
    with pytest.raises(NowledgeSyncError, match="max_sync_messages"):
        await client.sync_thread("chat", [message(1), message(2)], NowledgeIdentity())
    assert not mem_server.imports


async def test_cancellation_releases_cursor_and_borrowed_client() -> None:
    entered = asyncio.Event()
    release = asyncio.Event()

    async def respond(_request: httpx.Request) -> httpx.Response:
        entered.set()
        await release.wait()
        return httpx.Response(
            200,
            json={
                "success": True,
                "results": [{"success": True, "message_count": 1}],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        from nowledge_mem_pydantic_ai import NowledgeSettings

        client = NowledgeClient(
            NowledgeSettings(api_url="https://mem.example", application_id="cancel"),
            http_client=http,
        )
        identity = NowledgeIdentity()
        task = asyncio.create_task(client.sync_thread("chat", [message(1)], identity))
        await asyncio.wait_for(entered.wait(), timeout=5)
        with pytest.raises(NowledgeSyncError, match="Serialize"):
            await client.sync_thread("chat", [message(1)], identity)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        release.set()
        await client.sync_thread("chat", [message(1)], identity)
        assert not http.is_closed


@pytest.mark.parametrize(
    "data",
    [
        None,
        {"success": True, "results": []},
        {"success": True, "results": [{"success": True, "message_count": True}]},
        {"success": True, "results": [{"success": True, "message_count": -1}]},
    ],
)
async def test_malformed_ack_is_not_success(mem_server: MemServer, data: Any) -> None:
    with pytest.raises(NowledgeSyncError):
        NowledgeClient._acknowledgement(data, checkpointed=False)
