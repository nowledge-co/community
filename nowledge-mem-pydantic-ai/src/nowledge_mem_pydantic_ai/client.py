"""Small REST seam and acknowledged, bounded in-process Thread cursors."""

from __future__ import annotations

import hashlib
import json
import logging
from collections import OrderedDict
from collections.abc import Mapping
from dataclasses import dataclass
from threading import Lock
from typing import Any

import httpx

from .config import NowledgeIdentity, NowledgeSettings

logger = logging.getLogger("nowledge_mem_pydantic_ai")


class NowledgeSyncError(RuntimeError):
    """A Thread import was not acknowledged as persisted."""


class NowledgeScopeError(RuntimeError):
    """A Context Bundle did not confirm the explicitly selected Space."""


class _CheckpointConflict(NowledgeSyncError):
    pass


@dataclass(frozen=True)
class _Cursor:
    local_count: int
    remote_count: int
    fingerprint: str


def _fingerprint(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class NowledgeClient:
    """An injected HTTP client is caller-owned; otherwise requests own their connections."""

    def __init__(
        self,
        settings: NowledgeSettings | None = None,
        *,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings or NowledgeSettings.from_env()
        self.http_client = http_client
        self._cursors: OrderedDict[str, _Cursor] = OrderedDict()
        self._syncing: set[str] = set()
        self._lock = Lock()

    async def _request(
        self, method: str, path: str, identity: NowledgeIdentity, **kwargs: Any
    ) -> Any:
        async def send(client: httpx.AsyncClient) -> Any:
            response = await client.request(
                method,
                f"{self.settings.api_url}{path}",
                headers=self.settings.headers(identity),
                timeout=self.settings.timeout_seconds,
                follow_redirects=False,
                **kwargs,
            )
            response.raise_for_status()
            return response.json()

        if self.http_client is not None:
            return await send(self.http_client)
        async with httpx.AsyncClient() as client:
            return await send(client)

    async def context_bundle(self, identity: NowledgeIdentity) -> Mapping[str, Any]:
        params = {
            "source_app": "pydantic-ai",
            "include_working_memory": "true",
            **identity.model_dump(exclude_none=True),
        }
        data = await self._request("GET", "/context/bundle", identity, params=params)
        if not isinstance(data, dict) or not isinstance(data.get("rendered_markdown"), str):
            raise ValueError("Context Bundle did not contain rendered_markdown")
        if identity.space_id is not None:
            active = data.get("active_space")
            if not isinstance(active, dict) or active.get("primary_space_id") != identity.space_id:
                raise NowledgeScopeError("Context Bundle did not confirm the selected Space ID")
        return data

    def auxiliary_failure(self, operation: str, error: Exception) -> None:
        # Scope/auth failures cannot be interpreted as an empty/default destination.
        if isinstance(error, NowledgeScopeError):
            raise error
        if (
            isinstance(error, httpx.HTTPStatusError)
            and 400 <= error.response.status_code < 500
            and error.response.status_code not in {408, 429}
        ):
            raise RuntimeError(
                f"Nowledge Mem {operation} rejected; check identity and access"
            ) from None
        if not self.settings.fail_open:
            raise RuntimeError(f"Nowledge Mem {operation} failed") from None
        logger.warning("Nowledge Mem %s failed (%s)", operation, type(error).__name__)

    @staticmethod
    def _acknowledgement(data: Any, *, checkpointed: bool) -> int:
        if not isinstance(data, dict):
            raise NowledgeSyncError("Thread import returned a non-object acknowledgement")
        results = data.get("results")
        if isinstance(results, list) and any(
            isinstance(row, dict)
            and row.get("error_code") in {"checkpoint_conflict", "thread_not_found"}
            for row in results
        ):
            raise _CheckpointConflict("Thread checkpoint needs reconciliation")
        if (
            data.get("success") is not True
            or data.get("failed_count", 0) != 0
            or not isinstance(results, list)
            or len(results) != 1
            or not isinstance(results[0], dict)
            or results[0].get("success") is not True
        ):
            raise NowledgeSyncError("Thread import did not acknowledge persistence")
        row = results[0]
        count = row.get("message_count")
        if type(count) is not int or count < 0:
            raise NowledgeSyncError("Thread import did not report its message count")
        if checkpointed and row.get("append_mode") != "checkpointed":
            raise NowledgeSyncError("Thread import did not acknowledge a checkpointed append")
        return count

    async def sync_thread(
        self,
        conversation_id: str,
        messages: list[dict[str, Any]],
        identity: NowledgeIdentity,
    ) -> None:
        if not messages:
            return
        if len(messages) > self.settings.max_sync_messages:
            raise NowledgeSyncError("Conversation exceeds max_sync_messages; use explicit export")
        if not self.settings.application_id or not conversation_id.strip():
            raise NowledgeSyncError("Thread sync requires application and conversation identities")
        # Local Mem also has a global Thread namespace: changing Space must not
        # relocate an existing conversation into another Space.
        thread_id = "pydantic-ai:" + _fingerprint(
            [self.settings.application_id, identity.space_id, conversation_id]
        )
        key = _fingerprint([thread_id, identity.model_dump()])
        with self._lock:
            if thread_id in self._syncing:
                raise NowledgeSyncError("Serialize runs that write the same conversation")
            self._syncing.add(thread_id)
            cursor = self._cursors.get(key)
        try:
            start = 0
            if (
                cursor is not None
                and cursor.local_count <= len(messages)
                and _fingerprint(messages[: cursor.local_count]) == cursor.fingerprint
            ):
                start = cursor.local_count
            if start == len(messages):
                return
            payload: dict[str, Any] = {
                "thread_id": thread_id,
                "title": messages[0]["content"][:80],
                "source": "pydantic-ai",
                "tool_version": "nowledge-mem-pydantic-ai/0.1.0",
                "messages": messages[start:],
                "metadata": {"source_app": "pydantic-ai", **identity.model_dump(exclude_none=True)},
            }
            if identity.space_id is not None:
                payload["space_id"] = identity.space_id
            if start and cursor is not None:
                payload["expected_message_count"] = cursor.remote_count
                payload["idempotency_key"] = _fingerprint([thread_id, start, messages[start:]])
            try:
                data = await self._request("POST", "/threads/import", identity, json=payload)
                count = self._acknowledgement(data, checkpointed=bool(start))
            except _CheckpointConflict:
                payload["messages"] = messages
                payload.pop("expected_message_count", None)
                payload.pop("idempotency_key", None)
                data = await self._request("POST", "/threads/import", identity, json=payload)
                count = self._acknowledgement(data, checkpointed=False)
            with self._lock:
                self._cursors[key] = _Cursor(len(messages), count, _fingerprint(messages))
                self._cursors.move_to_end(key)
                while len(self._cursors) > 256:
                    self._cursors.popitem(last=False)
        finally:
            with self._lock:
                self._syncing.discard(thread_id)
