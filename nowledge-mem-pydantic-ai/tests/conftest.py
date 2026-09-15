"""Loopback-only MCP and REST fixture; no credentials or model providers required."""

from __future__ import annotations

import json
from collections import deque
from collections.abc import Iterator
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest

from nowledge_mem_pydantic_ai import NowledgeSettings


@dataclass
class MemServer:
    url: str = ""
    context_status: int = 200
    context: str = "context-one"
    resolved_space: str | None = None
    tool_error: bool = False
    requests: list[dict[str, Any]] = field(default_factory=list)
    imports: list[dict[str, Any]] = field(default_factory=list)
    responses: deque[dict[str, Any]] = field(default_factory=deque)
    threads: dict[tuple[str, str], dict[str, Any]] = field(default_factory=dict)

    def settings(self, **kwargs: Any) -> NowledgeSettings:
        return NowledgeSettings(api_url=self.url, **kwargs)


@pytest.fixture
def mem_server(monkeypatch: pytest.MonkeyPatch) -> Iterator[MemServer]:
    for name in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("NO_PROXY", "localhost,127.0.0.1")
    monkeypatch.setenv("no_proxy", "localhost,127.0.0.1")
    state = MemServer()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args: Any) -> None:
            pass

        def send_json(self, status: int, payload: Any) -> None:
            data = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:
            path = urlsplit(self.path)
            if path.path == "/context/bundle":
                query = parse_qs(path.query)
                state.requests.append(
                    {"kind": "context", "query": query, "headers": dict(self.headers)}
                )
                space = query.get("space_id", ["default"])[0]
                self.send_json(
                    state.context_status,
                    {
                        "rendered_markdown": f"{state.context} scope={space}",
                        "active_space": {"primary_space_id": state.resolved_space or space},
                    },
                )
            else:
                self.send_json(405, {"detail": "Use POST"})

        def do_DELETE(self) -> None:
            self.send_json(200, {})

        def do_POST(self) -> None:
            payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if self.path == "/threads/import":
                state.imports.append(payload)
                if state.responses:
                    self.send_json(200, state.responses.popleft())
                    return
                key = (payload.get("space_id", "default"), payload["thread_id"])
                messages = state.threads.setdefault(key, {})
                for message in payload["messages"]:
                    messages.setdefault(message["metadata"]["external_id"], message)
                row = {"success": True, "message_count": len(messages)}
                if "expected_message_count" in payload:
                    row["append_mode"] = "checkpointed"
                self.send_json(200, {"success": True, "failed_count": 0, "results": [row]})
                return
            if self.path != "/mcp":
                self.send_json(404, {})
                return
            method = payload["method"]
            state.requests.append(
                {"kind": method, "payload": payload, "headers": dict(self.headers)}
            )
            if "id" not in payload:
                self.send_json(202, {})
                return
            if method == "initialize":
                result = {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "mem-test", "version": "1.0"},
                }
            elif method == "tools/list":
                result = {
                    "tools": [
                        {
                            "name": "memory_search",
                            "description": "Search test memories",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "query": {"type": "string"},
                                    "space_id": {"type": "string"},
                                    "agent_id": {"type": "string"},
                                    "host_agent_id": {"type": "string"},
                                },
                                "required": ["query"],
                            },
                        }
                    ]
                }
            elif method == "tools/call":
                result = {
                    "content": [{"type": "text", "text": "recalled-memory-not-new-evidence"}],
                    "isError": state.tool_error,
                }
            else:
                result = {}
            self.send_json(200, {"jsonrpc": "2.0", "id": payload["id"], "result": result})

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
    worker.start()
    state.url = f"http://127.0.0.1:{server.server_port}"
    try:
        yield state
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
        assert not worker.is_alive()
