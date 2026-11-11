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
        result = config.fragment(url, "ApiKeyPluginVault", "registered-config-id")
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


def test_public_client_oauth_is_not_a_microsoft_dcr_candidate():
    metadata = {"registration_endpoint": "https://cloud.nowledge.co/oauth/register",
                "token_endpoint_auth_methods_supported": ["none"],
                "code_challenge_methods_supported": ["S256"]}
    assert config.oauth_compatibility(metadata)["microsoft_dcr_candidate"] is False
    with pytest.raises(ValueError, match="secret-bearing"):
        config.fragment("https://cloud.nowledge.co/mcp", "DynamicClientRegistration", "config-id", metadata)
    for method in ["client_secret_basic", "client_secret_post"]:
        candidate = dict(metadata, token_endpoint_auth_methods_supported=["none", method])
        assert config.oauth_compatibility(candidate)["microsoft_dcr_candidate"] is True
        assert config.oauth_compatibility(candidate)["tenant_verified"] is False
        remote = config.fragment("https://cloud.nowledge.co/mcp", "DynamicClientRegistration", "config-id", candidate)
        assert remote["agentConnectors"][0]["toolSource"]["remoteMcpServer"]["authorization"]["type"] == "DynamicClientRegistration"


def test_app_package_has_exact_files_and_never_overwrites(tmp_path):
    import struct
    import zipfile
    import zlib

    def icon(size):
        def chunk(kind, body):
            return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))
        return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress((b"\0" + b"\xff\xff\xff\0" * size) * size)) + chunk(b"IEND", b""))

    color, outline = tmp_path / "color.png", tmp_path / "outline.png"
    color.write_bytes(icon(192))
    outline.write_bytes(icon(32))
    manifest = config.app_manifest("https://app.example.com/mcp", "ApiKeyPluginVault", "config-id",
                                   "8607d6eb-e5a4-43de-a423-0e82227141c9")
    destination = tmp_path / "mem.zip"
    config.package(manifest, color, outline, destination)
    with zipfile.ZipFile(destination) as archive:
        assert set(archive.namelist()) == {"manifest.json", "color.png", "outline.png"}
        assert json.loads(archive.read("manifest.json")) == manifest
    original = destination.read_bytes()
    with pytest.raises(FileExistsError):
        config.package(manifest, color, outline, destination)
    assert destination.read_bytes() == original
    with pytest.raises(ValueError):
        config.png(outline, 192)
    with pytest.raises(ValueError):
        config.app_manifest("https://app.example.com/mcp", "ApiKeyPluginVault", "config-id", "not-a-uuid")


@pytest.mark.parametrize("metadata", [None, [], {"token_endpoint_auth_methods_supported": None},
                                        {"code_challenge_methods_supported": "S256"}])
def test_invalid_discovery_metadata_is_rejected(metadata):
    with pytest.raises(ValueError):
        config.oauth_compatibility(metadata)


def test_cli_reports_current_cloud_gap_without_minting_credentials(tmp_path):
    import subprocess
    import sys
    metadata = tmp_path / "discovery.json"
    metadata.write_text(json.dumps({"token_endpoint_auth_methods_supported": ["none"],
                                   "registration_endpoint": "https://cloud.nowledge.co/oauth/register",
                                   "code_challenge_methods_supported": ["S256"]}))
    command = [sys.executable, str(PACKAGE / "configure.py"), "--url", "https://cloud.nowledge.co/mcp",
               "--metadata", str(metadata)]
    check = subprocess.run(command + ["--format", "oauth-check"], capture_output=True, text=True)
    assert check.returncode == 0
    assert json.loads(check.stdout)["microsoft_dcr_candidate"] is False
    fragment = subprocess.run(command + ["--format", "agent-connectors", "--reference-id", "config-id"],
                              capture_output=True, text=True)
    assert fragment.returncode == 2
    assert not fragment.stdout
    assert "public-client-only OAuth is incompatible" in fragment.stderr
