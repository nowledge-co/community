from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def _load_client_module():
    plugin_dir = Path(__file__).resolve().parents[1]
    package_name = "nowledge_mem_hermes_remote_credentials"
    if package_name not in sys.modules:
        package = type(sys)(package_name)
        package.__path__ = [str(plugin_dir)]
        sys.modules[package_name] = package

    spec = importlib.util.spec_from_file_location(
        f"{package_name}.client",
        plugin_dir / "client.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


client_module = _load_client_module()


def test_retry_urls_strip_remote_api_without_credential_query_params():
    urls = client_module.NowledgeMemClient._retry_urls(
        "https://mem.example.com/remote-api/threads/import?existing=1"
    )

    assert urls == ["https://mem.example.com/threads/import?existing=1"]
    assert all("nmem_api_key" not in url.lower() for url in urls)


def test_api_post_retries_remote_api_path_with_auth_headers_only(monkeypatch):
    client = client_module.NowledgeMemClient()
    seen = []

    monkeypatch.setattr(client, "_api_url", lambda: "https://mem.example.com/remote-api")
    monkeypatch.setattr(client, "_api_key", lambda: "secret-token")

    def fake_request_json(url, body, headers):
        seen.append((url, headers.copy()))
        if len(seen) == 1:
            raise RuntimeError("proxy path failed")
        return {"success": True}

    monkeypatch.setattr(client, "_request_json", fake_request_json)

    assert client._api_post("/threads/import", {"messages": []}) == {"success": True}
    assert [url for url, _ in seen] == [
        "https://mem.example.com/remote-api/threads/import",
        "https://mem.example.com/threads/import",
    ]
    assert all("nmem_api_key" not in url.lower() for url, _ in seen)
    assert all(headers["Authorization"] == "Bearer secret-token" for _, headers in seen)
    assert all(headers["X-NMEM-API-Key"] == "secret-token" for _, headers in seen)
