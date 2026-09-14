"""MCP tool definitions with run-local, host-controlled identity."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field, replace
from typing import Any, Generic, TypeVar

from pydantic_ai import RunContext
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.toolsets import AbstractToolset, ToolsetTool

from .client import NowledgeClient
from .config import NowledgeIdentity, NowledgeSettings

DepsT = TypeVar("DepsT")
IdentitySelector = NowledgeIdentity | Callable[[RunContext[Any]], NowledgeIdentity] | None


@dataclass
class _RunState:
    identity: NowledgeIdentity
    mcp: MCPToolset[Any]
    context: str | None = None
    output_tools: set[str] = field(default_factory=set)


class NowledgeToolset(AbstractToolset[DepsT], Generic[DepsT]):
    """Use Mem's server-owned external-agent tool catalog without automatic capture."""

    def __init__(
        self,
        *,
        settings: NowledgeSettings | None = None,
        client: NowledgeClient | None = None,
        identity: IdentitySelector = None,
        id: str = "nowledge-mem",
        _state: _RunState | None = None,
    ) -> None:
        if settings is not None and client is not None:
            raise ValueError("Pass settings or client, not both")
        self.client = client or NowledgeClient(settings)
        self.identity = identity
        self._id = id
        self._state = _state

    @property
    def id(self) -> str:
        return self._id

    async def for_run(self, ctx: RunContext[DepsT]) -> NowledgeToolset[DepsT]:
        if self._state is not None:
            return self
        identity = (
            self.identity(ctx)
            if callable(self.identity)
            else self.identity or self.client.settings.identity
        )
        if not isinstance(identity, NowledgeIdentity):
            raise TypeError("identity callback must return NowledgeIdentity")
        settings = self.client.settings
        mcp = MCPToolset(
            settings.mcp_url or f"{settings.api_url}/mcp",
            id=self.id,
            headers=settings.headers(identity),
            init_timeout=settings.timeout_seconds,
            read_timeout=settings.timeout_seconds,
            include_instructions=False,
            prefer_tasks=False,
        )
        return NowledgeToolset(
            client=self.client, identity=identity, id=self.id, _state=_RunState(identity, mcp)
        )

    def _require_state(self) -> _RunState:
        if self._state is None:
            raise RuntimeError("NowledgeToolset must be bound to an Agent run")
        return self._state

    async def __aenter__(self) -> NowledgeToolset[DepsT]:
        if self._state is not None:
            await self._state.mcp.__aenter__()
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._state is not None:
            await self._state.mcp.__aexit__(*args)

    async def get_tools(self, ctx: RunContext[DepsT]) -> dict[str, ToolsetTool[DepsT]]:
        tools = await self._require_state().mcp.get_tools(ctx)
        return {name: replace(tool, toolset=self) for name, tool in tools.items()}

    async def call_tool(
        self, name: str, tool_args: dict[str, Any], ctx: RunContext[Any], tool: ToolsetTool[Any]
    ) -> Any:
        state = self._require_state()
        args = dict(tool_args)
        trusted = {**state.identity.model_dump(), "source_app": "pydantic-ai"}
        for key, value in trusted.items():
            if key in args:
                if value is None:
                    args.pop(key)
                else:
                    args[key] = value
        return await state.mcp.call_tool(name, args, ctx, tool)
