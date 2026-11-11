"""Exercise the real client over HTTP, rather than stubbing its request seam."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from test_remote_credentials import client_module


@pytest.fixture
def endpoint():
    calls = []
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            calls.append((self.path, body, self.headers))
            exact = self.headers.get("X-Nmem-Space-Protocol") == "exact-v1"
            self.send_response(200 if exact else 409)
            self.end_headers()
            self.wfile.write(json.dumps({"success": True} if exact else {
                "error_code": "space_client_upgrade_required"
            }).encode())
        def log_message(self, *args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", calls
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


@pytest.mark.parametrize("reference", [None, "Work", " 项目/ID "])
def test_import_and_append_declare_exact_protocol_and_preserve_space(endpoint, monkeypatch, reference):
    url, calls = endpoint
    client = client_module.NowledgeMemClient(space=reference)
    monkeypatch.setattr(client, "_api_url", lambda: url)
    monkeypatch.setattr(client, "_api_key", lambda: "synthetic-only")
    monkeypatch.setattr(client, "_cli", lambda args: {"spaces": [
        {"id": " 项目/ID ", "name": "Work"},
    ]})
    assert client.import_thread("probe", [{"role":"user", "content":"synthetic"}])["success"]
    assert client.append_thread("probe", [{"role":"assistant", "content":"synthetic"}])["success"]
    assert len(calls) == 2
    for path, body, headers in calls:
        assert headers["Authorization"] == "Bearer synthetic-only"
        assert "space_id" not in body if reference is None else body["space_id"] == " 项目/ID "
        assert "metadata" not in body


def test_unknown_or_ambiguous_configured_space_does_not_send(endpoint, monkeypatch):
    url, calls = endpoint
    client = client_module.NowledgeMemClient(space="Work")
    monkeypatch.setattr(client, "_api_url", lambda: url)
    monkeypatch.setattr(client, "_cli", lambda args: {"spaces": [{"id":"a", "name":"Work"}, {"id":"b", "name":"Work"}]})
    with pytest.raises(RuntimeError, match="ambiguous"):
        client.import_thread("probe", [{"role":"user", "content":"synthetic"}])
    assert calls == []
