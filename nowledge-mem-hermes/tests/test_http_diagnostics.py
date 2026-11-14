"""Safe support evidence from actual HTTP failures, without customer content."""

from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from test_remote_credentials import client_module
from test_session_sync import provider

REQUEST_ID = "01a1d8b8-3fed-7fd5-a71a-2ab81bc54519"
RAY_ID = "a5a3eb34b8d9afdb-NRT"
PRIVATE = "synthetic-private-content"


@pytest.fixture
def backend(monkeypatch, tmp_path):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("NMEM_API_KEY", "synthetic-api-key")
    state = {"status": 403, "headers": [("CF-Ray", RAY_ID)], "body": b"error code: 1010\n"}
    calls = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            calls.append((self.command, self.path, dict(self.headers), body))
            status, response_body = state.get("by_path", {}).get(
                self.path, (state["status"], state["body"])
            )
            self.send_response(status)
            for key, value in state["headers"]:
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)

        do_POST = do_GET

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(
        target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
    )
    worker.start()
    monkeypatch.setenv("NMEM_API_URL", f"http://127.0.0.1:{server.server_port}")
    try:
        yield state, calls
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
        assert not worker.is_alive()


def diagnostics(error):
    text = str(error)
    assert PRIVATE not in text
    assert "synthetic-api-key" not in text
    assert "synthetic-session-id" not in text
    assert "\n" not in text and "\r" not in text
    fields = json.loads(text.split("diagnostics=", 1)[1])
    assert (
        datetime.fromisoformat(fields["time_utc"].replace("Z", "+00:00"))
        .utcoffset()
        .total_seconds()
        == 0
    )
    assert fields["user_agent"] == f"NowledgeMem-Hermes/{fields['plugin_version']}"
    return fields


@pytest.mark.parametrize("prefix", ["", "/remote-api"])
@pytest.mark.parametrize(
    "operation,route",
    [
        ("import", "/threads/import"),
        ("append", "/threads/{thread_id}/append"),
        ("roster", "/spaces"),
    ],
)
@pytest.mark.parametrize("request_id", [None, REQUEST_ID])
def test_http_failure_keeps_only_safe_support_fields(
    backend, monkeypatch, prefix, operation, route, request_id
):
    state, calls = backend
    if request_id:
        state.update(
            status=422,
            body=PRIVATE.encode(),
            headers=[("CF-Ray", RAY_ID), ("X-Nmem-Request-Id", request_id)],
        )
    monkeypatch.setenv("NMEM_API_URL", client_module.NowledgeMemClient._api_url() + prefix)
    client = client_module.NowledgeMemClient(space="Work" if operation == "roster" else None)
    with pytest.raises(RuntimeError) as raised:
        if operation == "append":
            client.append_thread("synthetic-session-id", [{"role": "user", "content": PRIVATE}])
        else:
            client.import_thread("synthetic-session-id", [{"role": "user", "content": PRIVATE}])
    fields = diagnostics(raised.value)
    assert fields["method"] == ("GET" if operation == "roster" else "POST")
    assert fields["route"] == route
    assert fields["status"] == state["status"]
    assert fields["cf_ray"] == RAY_ID
    assert fields["request_id"] == request_id
    assert fields["edge_error_code"] == (None if request_id else "1010")
    assert isinstance(raised.value.__cause__, client_module.urlerror.HTTPError)
    for _, _, headers, _ in calls:
        assert headers["Authorization"] == "Bearer synthetic-api-key"
        assert headers["X-Nmem-Space-Protocol"] == "exact-v1"
        assert headers["User-Agent"] == fields["user_agent"]


@pytest.mark.parametrize(
    "headers",
    [
        [],
        [("CF-Ray", PRIVATE), ("X-Nmem-Request-Id", PRIVATE)],
        [("CF-Ray", "a" * 1000), ("X-Nmem-Request-Id", "b" * 1000)],
        [
            ("CF-Ray", RAY_ID),
            ("CF-Ray", RAY_ID),
            ("X-Nmem-Request-Id", REQUEST_ID),
            ("X-Nmem-Request-Id", REQUEST_ID),
        ],
        [
            ("CF-Ray", RAY_ID + "," + RAY_ID),
            ("X-Nmem-Request-Id", REQUEST_ID.replace("-7fd5-", "-4fd5-")),
        ],
    ],
)
def test_untrusted_or_missing_correlation_headers_are_absent(backend, headers):
    state, _ = backend
    state.update(headers=headers, body=(PRIVATE + "\r\nAuthorization: synthetic-api-key").encode())
    with pytest.raises(RuntimeError) as raised:
        client_module.NowledgeMemClient().import_thread(
            "synthetic-session-id", [{"role": "user", "content": PRIVATE}]
        )
    fields = diagnostics(raised.value)
    assert fields["cf_ray"] is None
    assert fields["request_id"] is None
    assert fields["edge_error_code"] is None


@pytest.mark.parametrize(
    "failure",
    [
        client_module.urlerror.URLError(PRIVATE + "?key=synthetic-api-key\n"),
        TimeoutError(PRIVATE),
    ],
)
def test_transport_failure_omits_raw_exception_and_url(monkeypatch, failure):
    def fail(*args, **kwargs):
        raise failure

    monkeypatch.setattr(client_module, "_urlopen", fail)
    with pytest.raises(RuntimeError) as raised:
        client_module.NowledgeMemClient()._request_json(
            "https://user:synthetic-api-key@example.invalid/threads/synthetic-session-id/append?secret="
            + PRIVATE,
            PRIVATE.encode(),
            {"Authorization": "Bearer synthetic-api-key"},
        )
    fields = diagnostics(raised.value)
    assert fields["failure"] == "transport"
    assert fields["status"] is None
    assert fields["route"] == "/threads/{thread_id}/append"
    assert fields["cf_ray"] is None and fields["request_id"] is None
    assert "example.invalid" not in str(raised.value)


@pytest.mark.parametrize(
    "body,kind",
    [(PRIVATE.encode(), "invalid_json"), (b"\xff" + PRIVATE.encode(), "invalid_encoding")],
)
def test_invalid_success_body_does_not_escape_into_errors(backend, body, kind):
    state, _ = backend
    state.update(status=200, body=body, headers=[("X-Nmem-Request-Id", REQUEST_ID)])
    with pytest.raises(RuntimeError) as raised:
        client_module.NowledgeMemClient().import_thread(
            "synthetic-session-id", [{"role": "user", "content": PRIVATE}]
        )
    fields = diagnostics(raised.value)
    assert fields["failure"] == kind
    assert fields["request_id"] == REQUEST_ID
    assert fields["status"] == 200


def test_oversized_error_body_does_not_become_an_edge_marker(backend):
    state, _ = backend
    state["body"] = b"error code: 1010" + b" " * 100 + PRIVATE.encode()
    with pytest.raises(RuntimeError) as raised:
        client_module.NowledgeMemClient().import_thread(
            "synthetic-session-id", [{"role": "user", "content": PRIVATE}]
        )
    assert diagnostics(raised.value)["edge_error_code"] is None


@pytest.mark.parametrize("append", [False, True])
@pytest.mark.parametrize("semantic", [False, True])
def test_provider_warning_correlates_failure_and_retains_pending_messages(
    backend, caplog, append, semantic
):
    state, calls = backend
    instance = provider.NowledgeMemProvider()
    instance._client = client_module.NowledgeMemClient()
    instance._cron_skipped = False
    instance._session_id = "synthetic-session-id"
    messages = [{"role": "user", "content": PRIVATE}]
    if append:
        initial = [{"role": "user", "content": "synthetic-acknowledged-prefix"}]
        state.update(status=200, body=b'{"success":true}')
        instance.on_session_end(initial)
        messages = initial + messages
        state.update(status=403, body=b"error code: 1010\n")
    if semantic:
        state.update(
            status=200,
            body=json.dumps(
                {"success": False, "results": [{"success": False, "error": PRIVATE}]}
            ).encode(),
            headers=[("CF-Ray", RAY_ID), ("X-Nmem-Request-Id", REQUEST_ID)],
        )
    before = datetime.now(timezone.utc)
    with caplog.at_level(logging.WARNING, logger=provider.__name__):
        instance.on_session_end(messages)
    record = next(record for record in caplog.records if "session " in record.getMessage())
    fields = diagnostics(record.getMessage())
    assert fields["cf_ray"] == RAY_ID
    assert fields["request_id"] == (REQUEST_ID if semantic else None)
    assert fields["failure"] == ("application" if semantic else "http")
    assert datetime.fromisoformat(fields["time_utc"].replace("Z", "+00:00")) >= before
    assert instance._pending_message_batches[instance._session_id] == [messages[-1]]
    state.update(status=200, body=b'{"success":true}')
    instance.on_session_end(messages)
    assert instance._session_id not in instance._pending_message_batches
    assert json.loads(calls[-1][3])["messages"] == [messages[-1]]


@pytest.mark.parametrize(
    "code,retryable,expected_code,expected_retryable",
    [
        ("space_client_upgrade_required", False, "space_client_upgrade_required", False),
        ("checkpoint_conflict", True, "checkpoint_conflict", True),
        ("thread_already_exists", False, "thread_already_exists", False),
        ("synthetic_private_content", "private", None, None),
        ("x" * 1000, 1, None, None),
    ],
)
def test_application_error_keeps_known_cause_without_raw_detail(
    backend, code, retryable, expected_code, expected_retryable
):
    state, _ = backend
    state.update(
        status=409,
        body=json.dumps({"error_code": code, "retryable": retryable, "detail": PRIVATE}).encode(),
    )
    with pytest.raises(RuntimeError) as raised:
        client_module.NowledgeMemClient().import_thread(
            "synthetic-session-id", [{"role": "user", "content": PRIVATE}]
        )
    fields = diagnostics(raised.value)
    assert fields["status"] == 409
    assert fields["error_code"] == expected_code
    assert fields["retryable"] is expected_retryable


@pytest.mark.parametrize("typed", [False, True])
def test_already_exists_negative_receipt_still_recovers_by_append(backend, typed, caplog):
    state, calls = backend
    rejection = {
        "success": False,
        "error": "Thread synthetic-session-id already exists in space default",
    }
    if typed:
        rejection = {"success": False, "error_code": "thread_already_exists"}
    state["body"] = json.dumps({"success": False, "results": [rejection]}).encode()
    state["status"] = 200
    state["by_path"] = {"/threads/synthetic-session-id/append": (200, b'{"success":true}')}
    instance = provider.NowledgeMemProvider()
    instance._client = client_module.NowledgeMemClient()
    instance._cron_skipped = False
    instance._session_id = "synthetic-session-id"
    messages = [{"role": "user", "content": PRIVATE}]
    with caplog.at_level(logging.WARNING, logger=provider.__name__):
        instance.on_session_end(messages)
    assert [call[1] for call in calls] == [
        "/threads/import",
        "/threads/synthetic-session-id/append",
    ]
    assert instance._session_id not in instance._pending_message_batches
    assert not caplog.records
