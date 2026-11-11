import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "nowledge-mem-m365-connector"
spec = importlib.util.spec_from_file_location("m365_configure", PACKAGE / "configure.py")
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)


@pytest.mark.parametrize("value", [
    "http://example.com/mcp", "https://localhost/mcp", "https://127.0.0.1/mcp",
    "https://[::1]/mcp", "https://10.1.2.3/mcp", "https://a.local/mcp",
    "https://a.trycloudflare.com/mcp", "https://u:secret@example.com/mcp",
    "https://example.com/mcp?key=secret", "https://example.com/mcp#secret",
    "https://example.com/mcp?space_protocol=legacy", "https://example.com/sse",
    "https://example.com/mcp?space_protocol=exact-v1&space_protocol=exact-v1",
    "https://example.com:bad/mcp", "https://example.com/mcp\n",
])
def test_reject_unsafe_or_incompatible_destination(value):
    with pytest.raises(ValueError):
        config.endpoint(value)


def test_both_destinations_keep_exact_protocol_and_auth_boundary():
    for origin in ["cloud.nowledge.co", "my-app.example.com:8443"]:
        url = f"https://{origin}/mcp"
        result = config.fragment(url, "DynamicClientRegistration", "registered-config-id")
        remote = result["agentConnectors"][0]["toolSource"]["remoteMcpServer"]
        assert remote["mcpServerUrl"] == url + "?space_protocol=exact-v1"
        assert remote["authorization"]["referenceId"] == "registered-config-id"
        assert "mcpToolDescription" not in remote
        assert config.endpoint(config.endpoint(url)) == config.endpoint(url)
        document = config.studio(url)
        assert document["host"] == origin
        operation = document["paths"]["/mcp"]["post"]
        assert operation["x-ms-agentic-protocol"] == "mcp-streamable-1.0"
        assert operation["parameters"][0]["enum"] == ["exact-v1"]
        assert document["securityDefinitions"]["memConnection"]["name"] == "Authorization"
        assert document["security"] == [{"memConnection": []}]


def test_registry_truthful_until_tenant_acceptance():
    registry = json.loads((ROOT / "integrations.json").read_text())
    row = next(r for r in registry["integrations"] if r["id"] == "microsoft-365-copilot")
    assert row["version"] == config.VERSION
    assert row["directory"] == PACKAGE.name
    assert row["availability"] == "guided"
    assert not any(row["capabilities"].values())
    assert "https://mem.nowledge.co/SKILL.md" in row["install"]["agentGuide"]["prompt"]
    assert "0.1.0" in (PACKAGE / "CHANGELOG.md").read_text()
