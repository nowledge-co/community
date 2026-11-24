"""Two real loopback origins; no user config, keys or transcript content."""

import importlib.util
import json
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@contextmanager
def endpoint(handler):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


@pytest.mark.parametrize("host", ["hermes", "openhands", "proma"])
@pytest.mark.parametrize("status", [302, 307, 308])
@pytest.mark.parametrize("method", ["GET", "POST"])
def test_redirect_does_not_forward_credentials_or_transcript(
    host, status, method, monkeypatch, tmp_path
):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("NMEM_API_KEY", "synthetic-only")
    received = []

    class Destination(BaseHTTPRequestHandler):
        def do_GET(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            received.append((dict(self.headers), body))
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"success":true}')

        do_POST = do_GET

        def log_message(self, *args):
            pass

    with endpoint(Destination) as destination:

        class Origin(BaseHTTPRequestHandler):
            def do_GET(self):
                self.rfile.read(int(self.headers.get("Content-Length", "0")))
                self.send_response(status)
                self.send_header("Location", destination + "/receive")
                self.end_headers()

            do_POST = do_GET

            def log_message(self, *args):
                pass

        with endpoint(Origin) as origin:
            monkeypatch.setenv("NMEM_API_URL", origin)
            file = {
                "hermes": "nowledge-mem-hermes/client.py",
                "openhands": "nowledge-mem-openhands-plugin/hooks/nmem_shared.py",
                "proma": "nowledge-mem-proma-plugin/hooks/save-to-nmem.py",
            }[host]
            spec = importlib.util.spec_from_file_location(
                "redirect_" + host, ROOT / file
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            body = (
                {
                    "messages": [
                        {"role": "user", "content": "Synthetic private transcript"}
                    ]
                }
                if method == "POST"
                else None
            )
            if host == "hermes":
                client = module.NowledgeMemClient()
                try:
                    client._request_json(
                        origin + "/threads/import",
                        json.dumps(body).encode(),
                        {
                            "Authorization": "Bearer synthetic-only",
                            "X-Nmem-Api-Key": "synthetic-only",
                        },
                        method=method,
                    )
                except RuntimeError:
                    pass
            elif host == "openhands":
                module.http_request(
                    "/threads/import",
                    method=method,
                    body=body,
                    config=(origin, "synthetic-only"),
                )
            else:
                module.api_request(method, "/threads/import", body)
            assert received == [], "a redirect received credentials or transcript bytes"
