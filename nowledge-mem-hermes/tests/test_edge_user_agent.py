"""Actual urllib requests must identify the plugin before reaching API auth."""
import importlib.util
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from test_remote_credentials import client_module


@pytest.mark.parametrize("base_path", ["", "/remote-api"])
@pytest.mark.parametrize("plugin", ["Hermes", "Proma"])
def test_product_identity_survives_cloud_and_app_requests(monkeypatch, tmp_path, base_path, plugin):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    calls = []

    class Handler(BaseHTTPRequestHandler):
        def handle_api(self):
            self.rfile.read(int(self.headers.get("Content-Length", "0")))
            ua = self.headers.get("User-Agent", "")
            calls.append((self.command, self.path, ua))
            if not ua.startswith(f"NowledgeMem-{plugin}/"):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"error code: 1010")
                return
            assert self.headers.get("Authorization") == "Bearer synthetic-only"
            assert self.headers.get("X-Nmem-Space-Protocol") == "exact-v1"
            payload = {"spaces": [{"id": "work-id", "name": "Work"}]} if self.command == "GET" else {"success": True}
            response = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

        do_GET = do_POST = handle_api

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    base = f"http://127.0.0.1:{server.server_port}{base_path}"
    try:
        if plugin == "Hermes":
            client = client_module.NowledgeMemClient(space="Work")
            monkeypatch.setattr(client, "_api_url", lambda: base)
            monkeypatch.setattr(client, "_api_key", lambda: "synthetic-only")
            assert client.import_thread("probe", [{"role": "user", "content": "synthetic"}])["success"]
            assert client.append_thread("probe", [{"role": "assistant", "content": "synthetic"}])["success"]
        else:
            hook_file = Path(__file__).resolve().parents[2] / "nowledge-mem-proma-plugin/hooks/save-to-nmem.py"
            spec = importlib.util.spec_from_file_location("proma_edge_qa", hook_file)
            hook = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(hook)
            monkeypatch.setattr(hook, "log", lambda *args: None)
            manifest = json.loads((hook_file.parents[1] / ".claude-plugin/plugin.json").read_text(encoding="utf-8"))
            assert hook.HEADERS["User-Agent"] == f"NowledgeMem-Proma/{manifest['version']}"
            monkeypatch.setitem(hook.HEADERS, "Authorization", "Bearer synthetic-only")
            monkeypatch.setattr(hook, "API_BASE", base)
            for route, method in [("/spaces", "GET"), ("/threads/import", "POST"), ("/threads/probe/messages", "POST")]:
                assert hook.api_request(method, route) is not None
        assert any(method == "GET" for method, _, _ in calls)
        assert sum(method == "POST" for method, _, _ in calls) == 2
        assert all(route.startswith(base_path + "/") for _, route, _ in calls)
    finally:
        server.shutdown()
        server.server_close()
        worker.join()
