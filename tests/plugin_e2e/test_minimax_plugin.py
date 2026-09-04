from __future__ import annotations

import json
import os
import stat
import struct
from pathlib import Path

import pytest


COMMUNITY_ROOT = Path(__file__).resolve().parents[2]
PLUGIN_ROOT = COMMUNITY_ROOT / "nowledge-mem-minimax-plugin"
MANIFEST_PATH = PLUGIN_ROOT / ".minimax-plugin" / "plugin.json"
FORBIDDEN_SECRET_MARKERS = (
    "access_token",
    "refresh_token",
    "client_secret",
    "api_key",
    "nmem_ck_",
    "nmem_ak_",
)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_sse_messages(body: str) -> list[dict]:
    messages = []
    for event in body.replace("\r\n", "\n").split("\n\n"):
        data_lines = []
        for line in event.splitlines():
            if line.startswith("data:"):
                data = line.removeprefix("data:").lstrip()
                if data:
                    data_lines.append(data)
        if data_lines:
            messages.append(json.loads("\n".join(data_lines)))
    return messages


def test_minimax_live_probe_ignores_empty_sse_keepalive() -> None:
    body = (
        "data: \n"
        "id: 0\n"
        "retry: 3000\n\n"
        'data: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n'
    )

    assert parse_sse_messages(body) == [
        {"jsonrpc": "2.0", "id": 1, "result": {"ok": True}}
    ]


def test_minimax_submission_retry_stays_new_until_listing_exists() -> None:
    submission = (PLUGIN_ROOT / "SUBMISSION.md").read_text(encoding="utf-8")

    assert "- Operation: `New plugin` until the first submission passes validation." in submission
    assert "A validation failure does not create an existing Marketplace plugin." in submission


def test_minimax_manifest_matches_official_package_contract() -> None:
    manifest = read_json(MANIFEST_PATH)

    assert manifest["schemaVersion"] == 1
    assert manifest["name"] == "nowledge-mem"
    assert manifest["version"] == "0.1.3"
    assert manifest["author"] == "Nowledge Labs"
    assert manifest["apps"] == []
    assert manifest["mcpServers"] == ["nowledge-mem-local.mcp.json"]
    assert manifest["skills"] == ["skills/nowledge-mem/SKILL.md"]
    example_queries = manifest["exampleQueries"]
    assert 0 <= len(example_queries) <= 3
    assert all(
        isinstance(query, str) and query.strip() and len(query) <= 4_096
        for query in example_queries
    )

    referenced = [manifest["icon"], *manifest["mcpServers"], *manifest["skills"]]
    for relative in referenced:
        path = PLUGIN_ROOT / relative
        assert path.is_file(), f"manifest reference does not resolve: {relative}"
        assert not path.is_symlink(), f"plugin packages may not contain symlinks: {relative}"


def test_minimax_local_mcp_is_loopback_streamable_http_without_credentials() -> None:
    config = read_json(PLUGIN_ROOT / "nowledge-mem-local.mcp.json")
    assert config["schemaVersion"] == 1
    assert set(config["mcpServers"]) == {"nowledge-mem"}

    server = config["mcpServers"]["nowledge-mem"]
    assert server["type"] == "streamable-http"
    assert server["url"] == "http://127.0.0.1:14242/mcp"
    assert server["enabled"] if "enabled" in server else True
    assert "headers" not in server
    assert "env" not in server


def test_minimax_skill_is_valid_and_truthful_about_thread_capture() -> None:
    skill = (PLUGIN_ROOT / "skills" / "nowledge-mem" / "SKILL.md").read_text(
        encoding="utf-8"
    )
    assert skill.startswith("---\nname: nowledge-mem\n")
    assert "description:" in skill.split("---", 2)[1]
    for tool in (
        "read_context_bundle",
        "memory_search",
        "memory_add",
        "thread_search",
    ):
        assert f"`{tool}`" in skill
    assert "does not have a verified MiniMax transcript or lifecycle hook" in skill
    assert "Do not claim that it automatically captures" in skill
    assert "Never request that a user paste an API key into chat" in skill


def test_minimax_package_has_no_secret_material_or_forbidden_payloads() -> None:
    forbidden_suffixes = {".exe", ".dll", ".dylib", ".so", ".node"}
    for path in PLUGIN_ROOT.rglob("*"):
        assert not path.is_symlink(), f"plugin packages may not contain symlinks: {path}"
        if not path.is_file():
            continue
        assert path.suffix.lower() not in forbidden_suffixes
        assert path.name not in {"install.sh", "install.ps1", "setup.py"}
        executable_mask = stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
        assert not (path.stat().st_mode & executable_mask), (
            f"executable bit is forbidden: {path}"
        )
        if path.suffix.lower() in {".json", ".md", ".txt"}:
            text = path.read_text(encoding="utf-8").lower()
            for marker in FORBIDDEN_SECRET_MARKERS:
                assert marker not in text, f"secret-like marker {marker!r} in {path}"


def test_minimax_icon_is_small_square_png() -> None:
    icon = PLUGIN_ROOT / "icon.png"
    data = icon.read_bytes()
    assert data.startswith(b"\x89PNG\r\n\x1a\n")
    width, height = struct.unpack(">II", data[16:24])
    assert (width, height) == (256, 256)
    assert len(data) <= 256_000


def test_minimax_registry_entry_matches_package() -> None:
    registry = read_json(COMMUNITY_ROOT / "integrations.json")
    entry = next(item for item in registry["integrations"] if item["id"] == "minimax")
    manifest = read_json(MANIFEST_PATH)

    assert entry["directory"] == PLUGIN_ROOT.name
    assert entry["version"] == manifest["version"]
    assert entry["transport"] == "plugin+skill+mcp"
    assert entry["capabilities"]["autoCapture"] is False
    assert entry["autonomy"]["threads"] == "handoff-only"
    assert entry["install"]["cloudProviderStatus"] == "pending-minimax-confirmation"


@pytest.mark.skipif(
    os.environ.get("NMEM_MINIMAX_LIVE") != "1",
    reason="set NMEM_MINIMAX_LIVE=1 to probe the running local Mem MCP",
)
def test_minimax_local_mcp_initialize_and_tool_discovery() -> None:
    import urllib.request

    session_id: str | None = None

    def rpc(payload: dict, *, expect_response: bool = True) -> dict:
        nonlocal session_id
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if session_id:
            headers["Mcp-Session-Id"] = session_id
        request = urllib.request.Request(
            "http://127.0.0.1:14242/mcp",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8")
            response_session_id = response.headers.get("Mcp-Session-Id")
        if response_session_id:
            session_id = response_session_id
        if not expect_response:
            assert not body.strip()
            return {}
        if not body.strip():
            pytest.fail("MCP response body was empty")
        if body.lstrip().startswith(("event:", "data:")):
            messages = parse_sse_messages(body)
            assert messages, "SSE response did not contain a data event"
            expected_id = payload.get("id")
            return next(
                (message for message in messages if message.get("id") == expected_id),
                messages[0],
            )
        return json.loads(body)

    initialized = rpc(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "MiniMax Code", "version": "test"},
            },
        }
    )
    assert initialized["result"]["serverInfo"]["name"]

    rpc(
        {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        },
        expect_response=False,
    )

    tools = rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    names = {tool["name"] for tool in tools["result"]["tools"]}
    assert {"read_context_bundle", "memory_search", "memory_add", "thread_search"} <= names
