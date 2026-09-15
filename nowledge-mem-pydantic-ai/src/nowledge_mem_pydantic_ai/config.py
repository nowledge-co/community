"""Connection settings and host-owned run identity."""

from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator


class NowledgeIdentity(BaseModel):
    """Non-authorizing selectors. The server still enforces credential permissions."""

    model_config = ConfigDict(frozen=True, extra="forbid", hide_input_in_errors=True)
    agent_id: str | None = None
    host_agent_id: str | None = None
    space_id: str | None = None

    @field_validator("agent_id", "host_agent_id", "space_id")
    @classmethod
    def valid_selector(cls, value: str | None) -> str | None:
        if value is not None and (not value.strip() or any(ord(c) < 32 for c in value)):
            raise ValueError("Selectors must be nonblank and contain no control characters")
        return value


class NowledgeSettings(BaseModel):
    """Explicit endpoint configuration; never guess the App's active port."""

    model_config = ConfigDict(frozen=True, extra="forbid", hide_input_in_errors=True)
    api_url: str
    api_key: SecretStr | None = Field(default=None, repr=False)
    mcp_url: str | None = None
    identity: NowledgeIdentity = Field(default_factory=NowledgeIdentity)
    application_id: str | None = None
    include_context: bool = True
    sync_threads: bool = False
    fail_open: bool = True
    timeout_seconds: float = Field(default=8, gt=0, le=60, allow_inf_nan=False)
    max_context_bytes: int = Field(default=8000, ge=512, le=32768)
    max_message_bytes: int = Field(default=16384, ge=512, le=65536)
    max_sync_messages: int = Field(default=2000, ge=1, le=20000)

    @field_validator("api_url", "mcp_url")
    @classmethod
    def valid_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
            or any(c.isspace() for c in value)
        ):
            raise ValueError("Use an HTTP(S) URL without credentials, query, or fragment")
        _ = parsed.port
        return value.rstrip("/")

    @model_validator(mode="after")
    def validate_destination(self) -> NowledgeSettings:
        if self.mcp_url:
            rest = urlsplit(self.api_url)
            mcp = urlsplit(self.mcp_url)
            if (rest.scheme, rest.hostname, rest.port) != (mcp.scheme, mcp.hostname, mcp.port):
                raise ValueError("REST and MCP endpoints must have the same origin")
        if self.sync_threads and (not self.application_id or not self.application_id.strip()):
            raise ValueError("Thread sync requires a stable application_id")
        if self.api_key:
            token = self.api_key.get_secret_value()
            if not token or any(c.isspace() for c in token):
                raise ValueError("api_key must be a bare token without whitespace")
        return self

    @classmethod
    def from_env(cls, **overrides: Any) -> NowledgeSettings:
        values: dict[str, Any] = {
            "identity": NowledgeIdentity(
                agent_id=os.getenv("NMEM_AGENT_ID"),
                host_agent_id=os.getenv("NMEM_HOST_AGENT_ID"),
                space_id=os.getenv("NMEM_SPACE"),
            ),
        }
        names = {
            "api_url": "NMEM_API_URL",
            "api_key": "NMEM_API_KEY",
            "mcp_url": "NMEM_MCP_URL",
            "application_id": "NMEM_PYDANTIC_AI_APP_ID",
            "sync_threads": "NMEM_PYDANTIC_AI_SYNC_THREADS",
        }
        for field, variable in names.items():
            if variable in os.environ:
                values[field] = os.environ[variable]
        values.update(overrides)
        return cls.model_validate(values)

    def headers(self, identity: NowledgeIdentity) -> dict[str, str]:
        headers = {
            "App": "pydantic-ai",
            "X-Nmem-Tool-Set": "external-agent",
            "X-Nowledge-Tool-Schema-Profile": "slim",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key.get_secret_value()}"
        for name, value in (
            ("X-Nmem-Agent-Id", identity.agent_id),
            ("X-Nmem-Host-Agent-Id", identity.host_agent_id),
            ("X-Nmem-Space-Id", identity.space_id),
        ):
            if value is not None:
                headers[name] = value
        return headers
