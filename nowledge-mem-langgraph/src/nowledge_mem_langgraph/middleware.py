"""LangChain `create_agent` middleware for transient context and Thread sync."""

from __future__ import annotations

import hashlib
import logging
from collections import OrderedDict
from collections.abc import Awaitable, Callable, Mapping
from threading import Lock
from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain.agents.middleware.types import ModelRequest, ModelResponse
from langchain_core.messages import BaseMessage, SystemMessage

from .client import NowledgeClient, ThreadCheckpointConflict
from .messages import (
    AcknowledgedCursor,
    default_title,
    normalize_messages,
    select_acknowledged_delta,
)

logger = logging.getLogger("nowledge_mem_langgraph")


class NowledgeMiddleware(AgentMiddleware):
    """Inject fresh Mem context and sync completed top-level agent turns.

    The Context Bundle is added only to the model request. It is never written
    into LangGraph state or checkpoints.
    """

    def __init__(self, client: NowledgeClient | None = None, *, cache_size: int = 256) -> None:
        self.client = client or NowledgeClient()
        self._cache_size = max(cache_size, 1)
        self._context_cache: OrderedDict[str, str] = OrderedDict()
        self._cache_lock = Lock()
        self._thread_cursors: OrderedDict[str, AcknowledgedCursor] = OrderedDict()
        self._thread_cursor_lock = Lock()

    @staticmethod
    def _is_nested(runtime: object | None) -> bool:
        info = getattr(runtime, "execution_info", None)
        namespace = str(getattr(info, "checkpoint_ns", "") or "")
        return "|" in namespace

    @staticmethod
    def _thread_id(runtime: object | None) -> str | None:
        info = getattr(runtime, "execution_info", None)
        value = getattr(info, "thread_id", None)
        cleaned = str(value).strip() if value is not None else ""
        return cleaned or None

    def _cache_key(self, request: ModelRequest[Any]) -> str:
        identity = self.client.settings.resolve_identity(request.runtime)
        info = getattr(request.runtime, "execution_info", None)
        run_id = str(getattr(info, "run_id", "") or "")
        latest_user = ""
        for message in reversed(request.messages):
            if getattr(message, "type", None) == "human":
                latest_user = str(message.id or message.content)
                break
        raw = "\0".join(
            [
                self._thread_id(request.runtime) or "stateless",
                run_id,
                latest_user,
                identity.agent_id or "",
                identity.host_agent_id or "",
                identity.space_id or "",
            ]
        )
        return hashlib.sha256(raw.encode()).hexdigest()

    def _get_cached(self, key: str) -> str | None:
        with self._cache_lock:
            value = self._context_cache.get(key)
            if value is not None:
                self._context_cache.move_to_end(key)
            return value

    def _put_cached(self, key: str, value: str) -> None:
        with self._cache_lock:
            self._context_cache[key] = value
            self._context_cache.move_to_end(key)
            while len(self._context_cache) > self._cache_size:
                self._context_cache.popitem(last=False)

    def _thread_cursor_key(self, thread_id: str, runtime: object) -> str:
        identity = self.client.settings.resolve_identity(runtime)
        return "\0".join(
            [
                thread_id,
                identity.space_id or "",
                identity.agent_id or "",
                identity.host_agent_id or "",
            ]
        )

    def _get_thread_cursor(self, key: str) -> AcknowledgedCursor | None:
        with self._thread_cursor_lock:
            value = self._thread_cursors.get(key)
            if value is not None:
                self._thread_cursors.move_to_end(key)
            return value

    def _put_thread_cursor(self, key: str, value: AcknowledgedCursor) -> None:
        with self._thread_cursor_lock:
            self._thread_cursors[key] = value
            self._thread_cursors.move_to_end(key)
            while len(self._thread_cursors) > self._cache_size:
                self._thread_cursors.popitem(last=False)

    @staticmethod
    def _inject(request: ModelRequest[Any], context: str) -> ModelRequest[Any]:
        if not context.strip():
            return request
        block = (
            "<nowledge_context_bundle>\n"
            "The following trusted, invocation-scoped context comes from Nowledge Mem. "
            "Use it when relevant; do not quote this wrapper.\n\n"
            f"{context.strip()}\n"
            "</nowledge_context_bundle>"
        )
        if request.system_message is None:
            system = SystemMessage(content=block)
        else:
            system = request.system_message.model_copy(
                update={"content": f"{request.system_message.text}\n\n{block}"}
            )
        return request.override(system_message=system)

    def _on_failure(self, operation: str, error: Exception) -> None:
        if not self.client.settings.fail_open:
            raise error
        logger.warning("Nowledge Mem %s failed; continuing without it: %s", operation, error)

    def wrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], ModelResponse[Any]],
    ) -> ModelResponse[Any]:
        if not self.client.settings.include_context or self._is_nested(request.runtime):
            return handler(request)
        key = self._cache_key(request)
        context = self._get_cached(key)
        if context is None:
            try:
                identity = self.client.settings.resolve_identity(request.runtime)
                bundle = self.client.context_bundle(identity)
                context = str(bundle.get("rendered_markdown", ""))
                self._put_cached(key, context)
            except Exception as error:
                self._on_failure("context read", error)
                context = ""
        return handler(self._inject(request, context))

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        if not self.client.settings.include_context or self._is_nested(request.runtime):
            return await handler(request)
        key = self._cache_key(request)
        context = self._get_cached(key)
        if context is None:
            try:
                identity = self.client.settings.resolve_identity(request.runtime)
                bundle = await self.client.acontext_bundle(identity)
                context = str(bundle.get("rendered_markdown", ""))
                self._put_cached(key, context)
            except Exception as error:
                self._on_failure("context read", error)
                context = ""
        return await handler(self._inject(request, context))

    def after_agent(self, state: Mapping[str, Any], runtime: object) -> None:
        self._sync(state, runtime)

    async def aafter_agent(self, state: Mapping[str, Any], runtime: object) -> None:
        await self._async(state, runtime)

    def _sync(self, state: Mapping[str, Any], runtime: object) -> None:
        if not self.client.settings.sync_threads or self._is_nested(runtime):
            return
        thread_id = self._thread_id(runtime)
        if thread_id is None:
            return
        messages = [m for m in state.get("messages", []) if isinstance(m, BaseMessage)]
        if not messages:
            return
        cursor_key = self._thread_cursor_key(thread_id, runtime)
        normalized = normalize_messages(messages)
        cursor = self._get_thread_cursor(cursor_key)
        delta, next_cursor, reset = select_acknowledged_delta(normalized, cursor)
        if not delta:
            return
        try:
            response = self.client.sync_thread(
                thread_id=thread_id,
                messages=messages,
                runtime=runtime,
                title=default_title(messages),
                normalized_messages=delta,
                expected_message_count=cursor[3] if cursor is not None and not reset else None,
                idempotency_key=(
                    f"langgraph:{thread_id}:{cursor[0]}-{next_cursor[0]}:{next_cursor[2]}"
                    if cursor is not None and not reset
                    else None
                ),
            )
            remote_count = self.client.thread_sync_message_count(response)
            self._put_thread_cursor(cursor_key, (*next_cursor[:3], remote_count))
        except ThreadCheckpointConflict:
            try:
                response = self.client.sync_thread(
                    thread_id=thread_id,
                    messages=messages,
                    runtime=runtime,
                    title=default_title(messages),
                    normalized_messages=normalized,
                )
                remote_count = self.client.thread_sync_message_count(response)
                self._put_thread_cursor(cursor_key, (*next_cursor[:3], remote_count))
            except Exception as error:
                self._on_failure("thread reconciliation", error)
        except Exception as error:
            self._on_failure("thread sync", error)

    async def _async(self, state: Mapping[str, Any], runtime: object) -> None:
        if not self.client.settings.sync_threads or self._is_nested(runtime):
            return
        thread_id = self._thread_id(runtime)
        if thread_id is None:
            return
        messages = [m for m in state.get("messages", []) if isinstance(m, BaseMessage)]
        if not messages:
            return
        cursor_key = self._thread_cursor_key(thread_id, runtime)
        normalized = normalize_messages(messages)
        cursor = self._get_thread_cursor(cursor_key)
        delta, next_cursor, reset = select_acknowledged_delta(normalized, cursor)
        if not delta:
            return
        try:
            response = await self.client.async_thread(
                thread_id=thread_id,
                messages=messages,
                runtime=runtime,
                title=default_title(messages),
                normalized_messages=delta,
                expected_message_count=cursor[3] if cursor is not None and not reset else None,
                idempotency_key=(
                    f"langgraph:{thread_id}:{cursor[0]}-{next_cursor[0]}:{next_cursor[2]}"
                    if cursor is not None and not reset
                    else None
                ),
            )
            remote_count = self.client.thread_sync_message_count(response)
            self._put_thread_cursor(cursor_key, (*next_cursor[:3], remote_count))
        except ThreadCheckpointConflict:
            try:
                response = await self.client.async_thread(
                    thread_id=thread_id,
                    messages=messages,
                    runtime=runtime,
                    title=default_title(messages),
                    normalized_messages=normalized,
                )
                remote_count = self.client.thread_sync_message_count(response)
                self._put_thread_cursor(cursor_key, (*next_cursor[:3], remote_count))
            except Exception as error:
                self._on_failure("thread reconciliation", error)
        except Exception as error:
            self._on_failure("thread sync", error)
