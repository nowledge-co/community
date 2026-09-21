from __future__ import annotations

import pytest
from pydantic import ValidationError

from nowledge_mem_pydantic_ai import NowledgeIdentity, NowledgeSettings


def test_explicit_destination_and_identity_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "NMEM_API_URL",
        "NMEM_API_KEY",
        "NMEM_MCP_URL",
        "NMEM_AGENT_ID",
        "NMEM_HOST_AGENT_ID",
        "NMEM_SPACE",
        "NMEM_PYDANTIC_AI_APP_ID",
        "NMEM_PYDANTIC_AI_SYNC_THREADS",
    ):
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(ValidationError, match="api_url"):
        NowledgeSettings.from_env()
    monkeypatch.setenv("NMEM_API_URL", "https://mem.example/remote-api/")
    monkeypatch.setenv("NMEM_MCP_URL", "https://mem.example/mcp")
    monkeypatch.setenv("NMEM_AGENT_ID", "trusted-agent")
    monkeypatch.setenv("NMEM_SPACE", "personal-exact-id")
    monkeypatch.setenv("NMEM_PYDANTIC_AI_APP_ID", "support")
    monkeypatch.setenv("NMEM_PYDANTIC_AI_SYNC_THREADS", "true")
    settings = NowledgeSettings.from_env()
    assert settings.api_url == "https://mem.example/remote-api"
    assert settings.identity.space_id == "personal-exact-id"
    assert settings.sync_threads


@pytest.mark.parametrize(
    "url",
    [
        "file:///tmp/mem",
        "https://user:password@mem.example",
        "https://mem.example?token=x",
        "https://mem.example#secret",
        "https://mem.example/ bad",
        "https://mem.example:bad",
    ],
)
def test_invalid_urls_are_rejected(url: str) -> None:
    with pytest.raises(ValidationError):
        NowledgeSettings(api_url=url)


def test_credentials_not_exposed_in_repr_or_validation_errors() -> None:
    settings = NowledgeSettings.model_validate(
        {
            "api_url": "https://mem.example",
            "api_key": "synthetic-secret",
        }
    )
    assert "synthetic-secret" not in repr(settings)
    with pytest.raises(ValidationError) as error:
        NowledgeSettings.model_validate(
            {
                "api_url": "https://mem.example",
                "api_key": "synthetic-secret",
                "mcp_url": "https://another.example/mcp",
            }
        )
    assert "synthetic-secret" not in str(error.value)


def test_capture_requires_app_identity_and_selectors_are_not_normalized() -> None:
    with pytest.raises(ValidationError, match="application_id"):
        NowledgeSettings(api_url="https://mem.example", sync_threads=True)
    assert NowledgeIdentity(agent_id="Agent.Exact-ID").agent_id == "Agent.Exact-ID"
    with pytest.raises(ValidationError):
        NowledgeIdentity(space_id="\nforged-header")
