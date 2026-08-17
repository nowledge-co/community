"""Configuration and trusted runtime identity resolution."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


def _clean(value: object | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _read(value: object, name: str) -> object | None:
    if isinstance(value, Mapping):
        return value.get(name)
    return getattr(value, name, None)


def _nested_nowledge(context: object | None) -> object | None:
    if context is None:
        return None
    return _read(context, "nowledge")


@dataclass(frozen=True, slots=True)
class NowledgeIdentity:
    """Mem's non-authorizing agent and Space selectors.

    `agent_id` is the portable Nowledge Agent identity. `host_agent_id` records
    the LangGraph deployment identity. Neither replaces the API key.
    """

    agent_id: str | None = None
    host_agent_id: str | None = None
    space_id: str | None = None

    def normalized(self) -> NowledgeIdentity:
        return NowledgeIdentity(
            agent_id=_clean(self.agent_id),
            host_agent_id=_clean(self.host_agent_id),
            space_id=_clean(self.space_id),
        )


@dataclass(frozen=True, slots=True)
class NowledgeSettings:
    """Connector settings shared by middleware, MCP tools, and thread sync."""

    api_url: str = "http://127.0.0.1:14242"
    api_key: str | None = field(default=None, repr=False)
    mcp_url: str | None = None
    application_id: str = "default"
    identity: NowledgeIdentity = field(default_factory=NowledgeIdentity)
    include_context: bool = True
    sync_threads: bool = True
    fail_open: bool = True
    timeout_seconds: float = 8.0
    tool_set: str = "external-agent"
    schema_profile: str = "slim"

    @classmethod
    def from_env(cls, **overrides: Any) -> NowledgeSettings:
        """Build settings from the portable Mem environment contract."""

        values: dict[str, Any] = {
            "api_url": os.getenv("NMEM_API_URL", "http://127.0.0.1:14242"),
            "api_key": os.getenv("NMEM_API_KEY"),
            "mcp_url": os.getenv("NMEM_MCP_URL"),
            "application_id": os.getenv("NMEM_LANGGRAPH_APP_ID", "default"),
            "identity": NowledgeIdentity(
                agent_id=os.getenv("NMEM_AGENT_ID"),
                host_agent_id=os.getenv("NMEM_HOST_AGENT_ID"),
                space_id=os.getenv("NMEM_SPACE"),
            ),
        }
        values.update(overrides)
        return cls(**values)

    def normalized(self) -> NowledgeSettings:
        api_url = self.api_url.rstrip("/")
        if not api_url:
            raise ValueError("api_url must not be empty")
        application_id = self.application_id.strip()
        if not application_id:
            raise ValueError("application_id must not be empty")
        if self.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be greater than zero")
        return NowledgeSettings(
            api_url=api_url,
            api_key=_clean(self.api_key),
            mcp_url=(self.mcp_url or f"{api_url}/mcp/").rstrip("/") + "/",
            application_id=application_id,
            identity=self.identity.normalized(),
            include_context=self.include_context,
            sync_threads=self.sync_threads,
            fail_open=self.fail_open,
            timeout_seconds=self.timeout_seconds,
            tool_set=self.tool_set.strip() or "external-agent",
            schema_profile=self.schema_profile.strip() or "slim",
        )

    def resolve_identity(self, runtime: object | None) -> NowledgeIdentity:
        """Resolve trusted invocation identity without treating user identity as agent identity.

        A runtime-provided agent selector replaces the whole static agent tuple,
        so a host cannot accidentally combine one tenant's `agent_id` with a
        different static `host_agent_id`. Space may be overridden independently.
        LangGraph Server's graph/assistant pair is host provenance only.
        """

        defaults = self.identity.normalized()
        context = getattr(runtime, "context", None)
        nested = _nested_nowledge(context)
        runtime_agent = _clean(_read(nested, "agent_id")) if nested is not None else None
        runtime_host = _clean(_read(nested, "host_agent_id")) if nested is not None else None
        runtime_space = _clean(_read(nested, "space_id")) if nested is not None else None

        if runtime_agent is not None or runtime_host is not None:
            agent_id = runtime_agent
            host_agent_id = runtime_host
        else:
            agent_id = defaults.agent_id
            host_agent_id = defaults.host_agent_id

        server_info = getattr(runtime, "server_info", None)
        if host_agent_id is None and server_info is not None:
            graph_id = _clean(getattr(server_info, "graph_id", None))
            assistant_id = _clean(getattr(server_info, "assistant_id", None))
            if graph_id and assistant_id:
                host_agent_id = f"langgraph:{graph_id}:{assistant_id}"

        return NowledgeIdentity(
            agent_id=agent_id,
            host_agent_id=host_agent_id,
            space_id=runtime_space or defaults.space_id,
        )

    def auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

    def scoped_headers(self, identity: NowledgeIdentity) -> dict[str, str]:
        headers = {
            **self.auth_headers(),
            "App": "langgraph",
            "X-Nmem-Tool-Set": self.tool_set,
            "X-Nowledge-Tool-Schema-Profile": self.schema_profile,
        }
        if identity.agent_id:
            headers["X-Nmem-Agent-Id"] = identity.agent_id
        if identity.host_agent_id:
            headers["X-Nmem-Host-Agent-Id"] = identity.host_agent_id
        if identity.space_id:
            headers["X-Nmem-Space-Id"] = identity.space_id
        return headers
