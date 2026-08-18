"""Local/Cloud REST client and LangChain MCP tool construction."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from typing import Any, cast

import httpx
from langchain_core.messages import BaseMessage
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.interceptors import MCPToolCallRequest
from langchain_mcp_adapters.sessions import Connection

from .config import NowledgeIdentity, NowledgeSettings
from .messages import default_title, normalize_messages

Handler = Callable[[MCPToolCallRequest], Awaitable[Any]]


class NowledgeClient:
    """Reusable connector client. Credentials stay in this object, never graph state."""

    def __init__(
        self,
        settings: NowledgeSettings | None = None,
        *,
        client: httpx.Client | None = None,
        async_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = (settings or NowledgeSettings.from_env()).normalized()
        self._client = client
        self._async_client = async_client

    def _params(self, identity: NowledgeIdentity) -> dict[str, str | bool]:
        params: dict[str, str | bool] = {
            "source_app": "langgraph",
            "include_working_memory": True,
        }
        if identity.agent_id:
            params["agent_id"] = identity.agent_id
        if identity.host_agent_id:
            params["host_agent_id"] = identity.host_agent_id
        if identity.space_id:
            params["space_id"] = identity.space_id
        return params

    def context_bundle(self, identity: NowledgeIdentity | None = None) -> Mapping[str, Any]:
        resolved = (identity or self.settings.identity).normalized()
        if self._client is not None:
            response = self._client.get(
                "/context/bundle",
                params=self._params(resolved),
                headers=self.settings.auth_headers(),
            )
        else:
            with httpx.Client(
                base_url=self.settings.api_url, timeout=self.settings.timeout_seconds
            ) as client:
                response = client.get(
                    "/context/bundle",
                    params=self._params(resolved),
                    headers=self.settings.auth_headers(),
                )
        response.raise_for_status()
        return response.json()

    async def acontext_bundle(self, identity: NowledgeIdentity | None = None) -> Mapping[str, Any]:
        resolved = (identity or self.settings.identity).normalized()
        if self._async_client is not None:
            response = await self._async_client.get(
                "/context/bundle",
                params=self._params(resolved),
                headers=self.settings.auth_headers(),
            )
        else:
            async with httpx.AsyncClient(
                base_url=self.settings.api_url, timeout=self.settings.timeout_seconds
            ) as client:
                response = await client.get(
                    "/context/bundle",
                    params=self._params(resolved),
                    headers=self.settings.auth_headers(),
                )
        response.raise_for_status()
        return response.json()

    def _thread_payload(
        self,
        *,
        thread_id: str,
        messages: list[BaseMessage],
        identity: NowledgeIdentity,
        runtime: object | None,
        title: str | None,
        normalized_messages: list[dict[str, Any]] | None = None,
        expected_message_count: int | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        server_info = getattr(runtime, "server_info", None)
        execution_info = getattr(runtime, "execution_info", None)
        metadata = {
            "source_app": "langgraph",
            "agent_id": identity.agent_id,
            "host_agent_id": identity.host_agent_id,
            "space_id": identity.space_id,
            "langgraph": {
                "application_id": self.settings.application_id,
                "graph_id": getattr(server_info, "graph_id", None),
                "assistant_id": getattr(server_info, "assistant_id", None),
                "last_run_id": getattr(execution_info, "run_id", None),
            },
        }
        payload = {
            "thread_id": f"langgraph:{self.settings.application_id}:{thread_id}",
            "title": title or default_title(messages),
            "messages": normalized_messages
            if normalized_messages is not None
            else normalize_messages(messages),
            "source": "langgraph",
            "space_id": identity.space_id,
            "tool_version": "nowledge-mem-langgraph/0.1.0",
            "metadata": metadata,
        }
        if expected_message_count is not None:
            payload["expected_message_count"] = expected_message_count
        if idempotency_key is not None:
            payload["idempotency_key"] = idempotency_key
        return payload

    @staticmethod
    def _validate_thread_sync_ack(data: object, expected_message_count: int | None) -> None:
        if not isinstance(data, Mapping):
            raise RuntimeError("Thread import returned a non-object acknowledgement")
        results = data.get("results")
        failed = data.get("failed_count")
        if data.get("success") is False or (isinstance(failed, int) and failed > 0):
            raise RuntimeError("Thread import reported a semantic failure")
        if isinstance(results, list) and any(
            isinstance(result, Mapping) and result.get("success") is False for result in results
        ):
            raise RuntimeError("Thread import result was not persisted")
        if expected_message_count is not None:
            first = results[0] if isinstance(results, list) and results else None
            if not isinstance(first, Mapping) or first.get("append_mode") != "checkpointed":
                raise RuntimeError("Thread import did not acknowledge the checkpointed suffix")

    def sync_thread(
        self,
        *,
        thread_id: str,
        messages: list[BaseMessage],
        identity: NowledgeIdentity | None = None,
        runtime: object | None = None,
        title: str | None = None,
        normalized_messages: list[dict[str, Any]] | None = None,
        expected_message_count: int | None = None,
        idempotency_key: str | None = None,
    ) -> Mapping[str, Any]:
        resolved = (identity or self.settings.resolve_identity(runtime)).normalized()
        payload = self._thread_payload(
            thread_id=thread_id,
            messages=messages,
            identity=resolved,
            runtime=runtime,
            title=title,
            normalized_messages=normalized_messages,
            expected_message_count=expected_message_count,
            idempotency_key=idempotency_key,
        )
        if self._client is not None:
            response = self._client.post(
                "/threads/import", json=payload, headers=self.settings.auth_headers()
            )
        else:
            with httpx.Client(
                base_url=self.settings.api_url, timeout=self.settings.timeout_seconds
            ) as client:
                response = client.post(
                    "/threads/import", json=payload, headers=self.settings.auth_headers()
                )
        response.raise_for_status()
        data = response.json()
        self._validate_thread_sync_ack(data, expected_message_count)
        return data

    async def async_thread(
        self,
        *,
        thread_id: str,
        messages: list[BaseMessage],
        identity: NowledgeIdentity | None = None,
        runtime: object | None = None,
        title: str | None = None,
        normalized_messages: list[dict[str, Any]] | None = None,
        expected_message_count: int | None = None,
        idempotency_key: str | None = None,
    ) -> Mapping[str, Any]:
        resolved = (identity or self.settings.resolve_identity(runtime)).normalized()
        payload = self._thread_payload(
            thread_id=thread_id,
            messages=messages,
            identity=resolved,
            runtime=runtime,
            title=title,
            normalized_messages=normalized_messages,
            expected_message_count=expected_message_count,
            idempotency_key=idempotency_key,
        )
        if self._async_client is not None:
            response = await self._async_client.post(
                "/threads/import", json=payload, headers=self.settings.auth_headers()
            )
        else:
            async with httpx.AsyncClient(
                base_url=self.settings.api_url, timeout=self.settings.timeout_seconds
            ) as client:
                response = await client.post(
                    "/threads/import", json=payload, headers=self.settings.auth_headers()
                )
        response.raise_for_status()
        data = response.json()
        self._validate_thread_sync_ack(data, expected_message_count)
        return data

    async def _scope_tool_call(self, request: MCPToolCallRequest, handler: Handler) -> Any:
        identity = self.settings.resolve_identity(request.runtime)
        headers = dict(request.headers or {})
        identity_headers = {
            "x-nmem-agent-id",
            "x-nmem-host-agent-id",
            "x-nmem-space-id",
        }
        headers = {
            key: value for key, value in headers.items() if key.lower() not in identity_headers
        }
        headers.update(self.settings.scoped_headers(identity))
        args = dict(request.args)
        trusted = {
            "agent_id": identity.agent_id,
            "host_agent_id": identity.host_agent_id,
            "space_id": identity.space_id,
            "source_app": "langgraph",
        }
        # Headers scope every Mem tool. Existing schema fields are also replaced
        # so model-authored arguments can never escape the host-selected scope.
        for key, value in trusted.items():
            if key in args:
                if value is None:
                    args.pop(key)
                else:
                    args[key] = value
        return await handler(request.override(args=args, headers=headers))

    async def tools(self) -> list[BaseTool]:
        """Load Mem's bounded external-agent MCP tool set."""

        static_identity = self.settings.identity.normalized()
        connection = cast(
            Connection,
            {
                "transport": "http",
                "url": self.settings.mcp_url,
                "headers": self.settings.scoped_headers(static_identity),
            },
        )
        client = MultiServerMCPClient(
            {"nowledge-mem": connection}, tool_interceptors=[self._scope_tool_call]
        )
        return await client.get_tools(server_name="nowledge-mem")
