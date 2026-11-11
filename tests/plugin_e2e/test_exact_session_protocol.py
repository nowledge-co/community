"""Direct HTTP hook producers must pass the same protocol boundary as the CLI."""
import importlib.util
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("host", ["proma", "openhands"])
def test_hooks_reach_protocol_enforcing_backend_without_customer_config(host, monkeypatch, tmp_path):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("NMEM_API_KEY", "synthetic-only")
    writes = []
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            assert self.headers.get("X-Nmem-Space-Protocol") == "exact-v1"
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps({"spaces": [{"id":"opaque/项目", "name":"Work"}]}).encode())
        def do_POST(self):
            payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            valid = self.headers.get("X-Nmem-Space-Protocol") == "exact-v1"
            self.send_response(200 if valid else 409)
            self.end_headers()
            if valid:
                writes.append(payload)
            self.wfile.write(json.dumps({"success": valid}).encode())
        def log_message(self, *args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    url = f"http://127.0.0.1:{server.server_port}"
    monkeypatch.setenv("NMEM_API_URL", url)
    file = ROOT / ("nowledge-mem-proma-plugin/hooks/save-to-nmem.py" if host == "proma" else "nowledge-mem-openhands-plugin/hooks/nmem_shared.py")
    spec = importlib.util.spec_from_file_location(f"exact_protocol_{host}", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    try:
        body = {"thread_id":"synthetic", "messages":[{"role":"user","content":"synthetic"}]}
        if host == "proma":
            result = module.api_request("POST", "/threads", body)
        else:
            body.update(space="Work", metadata={"space_id":"Work"})
            result = module.http_request("/threads/import", method="POST", body=body, config=(url,"synthetic-only"))
        assert result["success"] is True
        assert len(writes) == 1
        if host == "openhands":
            assert writes[0]["space_id"] == "opaque/项目"
        else:
            assert "space_id" not in writes[0]
    finally:
        server.shutdown()
        server.server_close()
        worker.join()
