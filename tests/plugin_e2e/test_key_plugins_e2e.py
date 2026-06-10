from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from textwrap import dedent
from typing import Any

import pytest


COMMUNITY_ROOT = Path(__file__).resolve().parents[2]
CLAUDE_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-claude-code-plugin"
CODEX_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-codex-plugin"
OPENCLAW_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-openclaw-plugin"
HERMES_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-hermes"
OPENCODE_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-opencode-plugin"
COPILOT_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-copilot-cli-plugin"
DROID_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-droid-plugin"
GEMINI_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-gemini-cli"
PROMA_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-proma-plugin"
CURSOR_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-cursor-plugin"
PI_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-pi-package"
BUB_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-bub-plugin"
BENCH_PACKAGE = COMMUNITY_ROOT / "nowledge-mem-bench"
KEY_HOSTS = {"claude", "codex", "openclaw", "hermes", "opencode", "pi"}


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _run(
    command: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    timeout: int = 60,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise AssertionError(
            "command failed\n"
            f"cmd: {' '.join(command)}\n"
            f"exit: {result.returncode}\n"
            f"stdout:\n{result.stdout[-4000:]}\n"
            f"stderr:\n{result.stderr[-4000:]}"
        )
    return result


def _nmem_json(args: list[str], *, env: dict[str, str], timeout: int = 30) -> Any:
    result = _run(["nmem", "--json", *args], env=env, timeout=timeout)
    stdout = result.stdout.strip()
    return json.loads(stdout) if stdout else {}


def _delete_marker_data(*, marker: str, space: str, env: dict[str, str]) -> None:
    # Host hooks can flush a thread a moment after a failed assertion. Cleanup
    # therefore does a short best-effort sweep before deleting the temporary
    # space, instead of assuming data is already visible on the first search.
    for attempt in range(5):
        deleted_any = False
        try:
            search = _nmem_json(["t", "search", marker, "--space", space, "-n", "50"], env=env)
            for thread in search.get("threads", []):
                thread_id = thread.get("id")
                if not thread_id:
                    continue
                try:
                    _run(["nmem", "t", "delete", thread_id, "--space", space, "-f"], env=env, timeout=30)
                    deleted_any = True
                except Exception:
                    pass
        except Exception:
            pass
        try:
            memories = _nmem_json(["m", "search", marker, "--space", space, "-n", "50"], env=env)
            memory_ids = [memory.get("id") for memory in memories.get("memories", []) if memory.get("id")]
            if memory_ids:
                try:
                    _run(["nmem", "m", "delete", *memory_ids, "--space", space, "-f"], env=env, timeout=30)
                    deleted_any = True
                except Exception:
                    pass
        except Exception:
            pass
        if not deleted_any and attempt >= 1:
            return
        time.sleep(2)


def _bool_env(name: str, *, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _requested_hosts() -> set[str]:
    raw = os.environ.get("NMEM_PLUGIN_E2E_HOSTS", "claude,codex,openclaw,hermes")
    requested = {item.strip().lower() for item in raw.split(",") if item.strip()}
    unknown = requested - KEY_HOSTS
    if unknown:
        raise AssertionError(f"unknown NMEM_PLUGIN_E2E_HOSTS values: {sorted(unknown)}")
    return requested


def _require_live_host(host: str) -> None:
    if not _bool_env("NMEM_PLUGIN_E2E"):
        pytest.skip("set NMEM_PLUGIN_E2E=1 to run live host integration tests")
    if host not in _requested_hosts():
        pytest.skip(f"{host} not requested by NMEM_PLUGIN_E2E_HOSTS")
    executable = "claude" if host == "claude" else host
    if shutil.which(executable) is None:
        raise AssertionError(f"requested host executable not found on PATH: {executable}")
    if shutil.which("nmem") is None:
        raise AssertionError("requested live plugin E2E requires nmem on PATH")


def _skip_live_host(host: str) -> bool:
    return (not _bool_env("NMEM_PLUGIN_E2E")) or host not in _requested_hosts()


@dataclass(frozen=True)
class E2EContext:
    run_id: str
    marker: str
    space: str
    owns_space: bool
    env: dict[str, str]


@pytest.fixture(scope="session")
def e2e_context() -> E2EContext:
    if not _bool_env("NMEM_PLUGIN_E2E"):
        pytest.skip("set NMEM_PLUGIN_E2E=1 to run live host integration tests")

    run_id = uuid.uuid4().hex[:10]
    prefix = os.environ.get("NMEM_E2E_SPACE_PREFIX", "nmem-plugin-e2e")
    explicit_space = os.environ.get("NMEM_E2E_SPACE")
    owns_space = not explicit_space
    space = explicit_space or f"{prefix}-{run_id}"
    marker = f"nmem-plugin-e2e-{run_id}"

    env = os.environ.copy()
    if os.environ.get("NMEM_E2E_API_URL"):
        env["NMEM_API_URL"] = os.environ["NMEM_E2E_API_URL"]
    if os.environ.get("NMEM_E2E_API_KEY"):
        env["NMEM_API_KEY"] = os.environ["NMEM_E2E_API_KEY"]
    env["NMEM_SPACE"] = space
    env["NMEM_SPACE_ID"] = space

    if owns_space:
        _run(
            [
                "nmem",
                "spaces",
                "create",
                space,
                "--description",
                f"Temporary plugin E2E space {marker}",
                "--icon",
                "flask",
            ],
            env=env,
            timeout=30,
        )

    ctx = E2EContext(run_id=run_id, marker=marker, space=space, owns_space=owns_space, env=env)
    yield ctx

    if _bool_env("NMEM_E2E_KEEP_DATA"):
        return
    try:
        _delete_marker_data(marker=marker, space=space, env=env)
    finally:
        if owns_space:
            _run(
                ["nmem", "spaces", "delete", space, "-f", "--purge-working-memory"],
                env=env,
                timeout=30,
            )


def _poll_thread(
    *,
    marker: str,
    source: str,
    space: str,
    env: dict[str, str],
    timeout_seconds: int | None = None,
) -> dict[str, Any]:
    deadline = time.time() + (timeout_seconds or int(os.environ.get("NMEM_E2E_POLL_SECONDS", "90")))
    last: Any = None
    while time.time() < deadline:
        last = _nmem_json(
            ["t", "search", marker, "--source", source, "--space", space, "-n", "10"],
            env=env,
            timeout=30,
        )
        threads = last.get("threads", [])
        if threads:
            thread_id = threads[0].get("id")
            if thread_id:
                thread = _nmem_json(
                    ["t", "show", thread_id, "--space", space, "-n", "50", "--content-limit", "2000"],
                    env=env,
                    timeout=30,
                )
                assert marker in json.dumps(thread, ensure_ascii=False)
                return thread
        time.sleep(3)
    raise AssertionError(f"no synced {source} thread found for marker {marker}; last={last}")


def _latest_codex_transcript(codex_home: Path) -> Path:
    sessions_dir = codex_home / "sessions"
    candidates = sorted(sessions_dir.glob("**/*.jsonl"), key=lambda path: path.stat().st_mtime)
    if not candidates:
        raise AssertionError(f"no Codex transcript files found under {sessions_dir}")
    return candidates[-1]


def _codex_transcript_meta(transcript: Path) -> dict[str, Any]:
    with transcript.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            event = json.loads(line)
            if event.get("type") == "session_meta":
                payload = event.get("payload")
                if isinstance(payload, dict):
                    return payload
    raise AssertionError(f"no session_meta event found in {transcript}")


def test_key_plugin_static_contracts_are_declared():
    registry = _read_json(COMMUNITY_ROOT / "integrations.json")
    historical_commands = {
        item["id"]: item["threadSave"].get("historicalCommand")
        for item in registry["integrations"]
        if item.get("id")
    }
    assert historical_commands["claude-code"] == "nmem t sync --from claude-code --all-projects"
    assert historical_commands["codex-cli"] == "nmem t sync --from codex --all-projects"
    assert historical_commands["gemini-cli"] == "nmem t sync --from gemini-cli --all-projects"
    assert historical_commands["opencode"] == "nmem t sync --from opencode --all-projects"
    assert historical_commands["pi"] == "nmem t sync --from pi"

    claude_manifest = _read_json(CLAUDE_PLUGIN / ".claude-plugin" / "plugin.json")
    claude_hooks = _read_json(CLAUDE_PLUGIN / "hooks" / "hooks.json")["hooks"]
    assert claude_manifest["name"] == "nowledge-mem"
    assert {"SessionStart", "UserPromptSubmit", "PreCompact", "Stop"} <= set(claude_hooks)
    assert "nmem-hook-read.sh" in json.dumps(claude_hooks)
    assert "nmem-hook-save.py" in json.dumps(claude_hooks)
    assert "wm read" not in json.dumps(claude_hooks)
    assert (CLAUDE_PLUGIN / "scripts" / "nmem-hook-read.sh").exists()
    assert (CLAUDE_PLUGIN / "skills" / "save-thread" / "SKILL.md").exists()

    codex_manifest = _read_json(CODEX_PLUGIN / ".codex-plugin" / "plugin.json")
    codex_mcp = _read_json(CODEX_PLUGIN / ".mcp.json")
    codex_hooks = _read_json(CODEX_PLUGIN / "hooks" / "hooks.json")["hooks"]
    assert codex_manifest["name"] == "nowledge-mem"
    assert codex_manifest["skills"] == "./skills/"
    assert codex_manifest["mcpServers"] == "./.mcp.json"
    assert codex_manifest["hooks"] == "./hooks/hooks.json"
    assert codex_mcp["mcpServers"]["nowledge-mem"]["type"] == "http"
    assert "Stop" in codex_hooks
    assert "nmem-stop-save.py" in json.dumps(codex_hooks)
    codex_stop_commands = [
        hook.get("command", "")
        for entry in codex_hooks.get("Stop", [])
        if isinstance(entry, dict)
        for hook in entry.get("hooks", [])
        if isinstance(hook, dict)
    ]
    assert any('"${PLUGIN_ROOT}/hooks/nmem-stop-save.py"' in command for command in codex_stop_commands)
    assert (CODEX_PLUGIN / "scripts" / "install_hooks.py").exists()
    assert (CODEX_PLUGIN / "skills" / "working-memory" / "SKILL.md").exists()
    assert (CODEX_PLUGIN / "skills" / "save-thread" / "SKILL.md").exists()

    openclaw_manifest = _read_json(OPENCLAW_PLUGIN / "openclaw.plugin.json")
    openclaw_pkg = _read_json(OPENCLAW_PLUGIN / "package.json")
    openclaw_client = (OPENCLAW_PLUGIN / "src" / "client.js").read_text(encoding="utf-8")
    openclaw_spawn_env = (OPENCLAW_PLUGIN / "src" / "spawn-env.js").read_text(encoding="utf-8")
    openclaw_context_tool = (OPENCLAW_PLUGIN / "src" / "tools" / "context.js").read_text(encoding="utf-8")
    schema = openclaw_manifest["configSchema"]["properties"]
    assert openclaw_manifest["version"] == "0.8.26"
    assert openclaw_pkg["version"] == "0.8.26"
    assert openclaw_manifest["kind"] == ["memory", "context-engine"]
    assert "skills/memory-guide" in openclaw_manifest["skills"]
    assert schema["sessionDigest"]["default"] is True
    assert schema["sessionContext"]["default"] is False
    assert "dreaming" in schema
    assert "readContextBundle" in openclaw_client
    assert "readStartupContext" in openclaw_client
    assert "--source-app\", \"openclaw" in openclaw_client
    assert "process.env" not in openclaw_client
    assert "NMEM_AGENT_ID" not in openclaw_client
    assert "NMEM_HOST_AGENT_ID" not in openclaw_client
    assert "process.env" in openclaw_spawn_env
    assert "rendered_markdown" in openclaw_client
    assert "readStartupContext" in openclaw_context_tool
    assert (OPENCLAW_PLUGIN / "src" / "index.js").exists()

    hermes_manifest = (HERMES_PLUGIN / "plugin.yaml").read_text(encoding="utf-8")
    assert "name: nowledge-mem" in hermes_manifest
    for hook in (
        "prefetch",
        "post_llm_call",
        "on_memory_write",
        "on_pre_compress",
        "on_session_end",
    ):
        assert f"  - {hook}" in hermes_manifest
    assert (HERMES_PLUGIN / "provider.py").exists()
    assert (HERMES_PLUGIN / "client.py").exists()

    opencode_pkg = _read_json(OPENCODE_PLUGIN / "package.json")
    opencode_source = (OPENCODE_PLUGIN / "src" / "index.ts").read_text(encoding="utf-8")
    assert opencode_pkg["name"] == "opencode-nowledge-mem"
    assert opencode_pkg["version"] == "0.3.4"
    assert "fetchSessionMessages" in opencode_source
    assert "path: { id: ctx.sessionID }" in opencode_source
    assert "nowledge_mem_context_bundle" in opencode_source
    assert 'nmem(["context", "--source-app", "opencode"])' in opencode_source
    assert "withAmbientSpaceArg(args)" in opencode_source
    assert "ambientAgentId" in opencode_source
    assert "ambientHostAgentId" in opencode_source
    assert "NMEM_AGENT_ID" in opencode_source
    assert "NMEM_HOST_AGENT_ID" in opencode_source
    assert '["context", "ctx", "wm", "m", "memories", "t", "threads"]' in opencode_source
    assert "nowledge_mem_save_thread" in opencode_source

    copilot_manifest = _read_json(COPILOT_PLUGIN / ".claude-plugin" / "plugin.json")
    copilot_hooks = _read_json(COPILOT_PLUGIN / "hooks" / "hooks.json")
    assert copilot_manifest["version"] == "0.1.3"
    assert "--source-app copilot-cli" in json.dumps(copilot_hooks)
    assert "NMEM_AGENT_ID" in json.dumps(copilot_hooks)
    assert "NMEM_HOST_AGENT_ID" in json.dumps(copilot_hooks)
    assert "rendered_markdown" in json.dumps(copilot_hooks)
    assert "wm read" in json.dumps(copilot_hooks)

    droid_manifest = _read_json(DROID_PLUGIN / ".factory-plugin" / "plugin.json")
    droid_hooks = _read_json(DROID_PLUGIN / "hooks" / "hooks.json")
    assert droid_manifest["version"] == "0.1.1"
    assert "--source-app droid" in json.dumps(droid_hooks)
    assert "NMEM_AGENT_ID" in json.dumps(droid_hooks)
    assert "NMEM_HOST_AGENT_ID" in json.dumps(droid_hooks)
    assert "rendered_markdown" in json.dumps(droid_hooks)
    assert "wm read" in json.dumps(droid_hooks)

    gemini_pkg = _read_json(GEMINI_PLUGIN / "package.json")
    gemini_hook = (GEMINI_PLUGIN / "hooks" / "session-start.mjs").read_text(encoding="utf-8")
    assert gemini_pkg["version"] == "0.1.9"
    assert "context', '--source-app', 'gemini-cli'" in gemini_hook
    assert "NMEM_AGENT_ID" in gemini_hook
    assert "NMEM_HOST_AGENT_ID" in gemini_hook
    assert "rendered_markdown" in gemini_hook
    assert "wm', 'read'" in gemini_hook

    proma_manifest = _read_json(PROMA_PLUGIN / ".claude-plugin" / "plugin.json")
    proma_hook = (PROMA_PLUGIN / "hooks" / "read-working-memory.py").read_text(encoding="utf-8")
    assert proma_manifest["version"] == "0.1.1"
    assert '"context", "--source-app", "proma"' in proma_hook
    assert "NMEM_AGENT_ID" in proma_hook
    assert "NMEM_HOST_AGENT_ID" in proma_hook
    assert '"wm", "read"' in proma_hook

    cursor_manifest = _read_json(CURSOR_PLUGIN / ".cursor-plugin" / "plugin.json")
    cursor_hook = (CURSOR_PLUGIN / "hooks" / "session-start.mjs").read_text(encoding="utf-8")
    assert cursor_manifest["version"] == "0.1.6"
    assert "'context', '--source-app', 'cursor'" in cursor_hook
    assert "NMEM_AGENT_ID" in cursor_hook
    assert "NMEM_HOST_AGENT_ID" in cursor_hook
    assert "rendered_markdown" in cursor_hook
    assert "'wm', 'read'" in cursor_hook

    pi_pkg = _read_json(PI_PLUGIN / "package.json")
    pi_extension = (PI_PLUGIN / "extensions" / "nowledge-mem.ts").read_text(encoding="utf-8")
    pi_history_sync = (PI_PLUGIN / "scripts" / "sync-history.mjs").read_text(encoding="utf-8")
    assert pi_pkg["version"] == "0.8.1"
    assert "./extensions/nowledge-mem.ts" in pi_pkg["pi"]["extensions"]
    assert "./skills" in pi_pkg["pi"]["skills"]
    assert pi_pkg["bin"]["nowledge-mem-pi-sync"] == "./scripts/sync-history.mjs"
    assert 'pi.on("agent_end"' in pi_extension
    assert 'pi.on("session_shutdown"' in pi_extension
    assert 'pi.on("session_before_switch"' in pi_extension
    assert 'pi.on("session_before_compact"' in pi_extension
    assert 'source: SOURCE_APP' in pi_extension
    assert 'metadata: {' in pi_extension
    assert "external_id" in pi_extension
    assert "deduplicate: true" in pi_extension
    assert "NMEM_AGENT_ID" in pi_extension
    assert "NMEM_HOST_AGENT_ID" in pi_extension
    assert "custom" in pi_extension
    assert "PI_CODING_AGENT_SESSION_DIR" in pi_history_sync
    assert "--apply" in pi_history_sync
    assert "historical_import: true" in pi_history_sync
    assert "deduplicate: true" in pi_history_sync
    assert "branchEntries" in pi_history_sync


def test_pi_history_sync_script_previews_and_appends_idempotently(tmp_path: Path):
    if shutil.which("node") is None:
        pytest.skip("Pi history sync script smoke requires node on PATH")

    session_dir = tmp_path / "pi-sessions"
    session_dir.mkdir()
    session_file = session_dir / "session-one.jsonl"
    session_file.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "type": "session",
                        "version": 3,
                        "id": "History Session/One",
                        "timestamp": "2026-06-10T00:00:00Z",
                        "cwd": "/tmp/pi-history-project",
                    }
                ),
                json.dumps(
                    {
                        "type": "message",
                        "id": "u1",
                        "parentId": None,
                        "timestamp": "2026-06-10T00:00:01Z",
                        "message": {"role": "user", "content": "history user message"},
                    }
                ),
                json.dumps(
                    {
                        "type": "message",
                        "id": "old-assistant",
                        "parentId": "u1",
                        "timestamp": "2026-06-10T00:00:02Z",
                        "message": {"role": "assistant", "content": "abandoned branch should not import"},
                    }
                ),
                json.dumps(
                    {
                        "type": "message",
                        "id": "ctx",
                        "parentId": "u1",
                        "timestamp": "2026-06-10T00:00:03Z",
                        "message": {"role": "custom", "content": "Context Bundle should not sync"},
                    }
                ),
                json.dumps(
                    {
                        "type": "message",
                        "id": "a1",
                        "parentId": "ctx",
                        "timestamp": "2026-06-10T00:00:04Z",
                        "message": {"role": "assistant", "content": "history assistant message"},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    script = PI_PLUGIN / "scripts" / "sync-history.mjs"
    preview = _run(["node", str(script), "--session-dir", str(session_dir), "--json"], timeout=30)
    preview_json = json.loads(preview.stdout)
    assert preview_json["summary"]["apply"] is False
    assert preview_json["summary"]["found"] == 1
    assert preview_json["summary"]["importable"] == 1
    assert preview_json["sessions"][0]["threadId"] == "pi-history-session-one"
    assert preview_json["sessions"][0]["messageCount"] == 2
    preview_text = json.dumps(preview_json)
    assert "Context Bundle should not sync" not in preview_text
    assert "abandoned branch should not import" not in preview_text

    calls: list[dict[str, Any]] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
            length = int(self.headers.get("content-length", "0"))
            body = self.rfile.read(length).decode("utf-8")
            calls.append(
                {
                    "path": self.path,
                    "headers": dict(self.headers),
                    "body": json.loads(body) if body else {},
                }
            )
            if self.path == "/threads":
                self.send_response(409)
                self.send_header("content-type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"detail":"thread already exists"}')
                return
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true,"messages_added":0}')

        def log_message(self, format: str, *args: Any) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        env = os.environ.copy()
        env["NMEM_API_URL"] = f"http://127.0.0.1:{server.server_address[1]}"
        env["NMEM_SPACE"] = "pi-history-space"
        env["NMEM_AGENT_ID"] = "PiHistoryAgent"
        env["NMEM_HOST_AGENT_ID"] = "slock:PiHistoryAgent"
        result = _run(
            ["node", str(script), "--session-dir", str(session_dir), "--json", "--apply"],
            env=env,
            timeout=30,
        )
    finally:
        server.shutdown()
        thread.join(timeout=5)

    applied = json.loads(result.stdout)
    assert applied["summary"]["created"] == 0
    assert applied["summary"]["appended"] == 1
    assert applied["summary"]["failed"] == 0
    assert [call["path"] for call in calls] == ["/threads", "/threads/pi-history-session-one/append"]

    create_body = calls[0]["body"]
    append_body = calls[1]["body"]
    assert create_body["source"] == "pi"
    assert create_body["space_id"] == "pi-history-space"
    assert create_body["metadata"]["historical_import"] is True
    assert create_body["metadata"]["analysis"] == "searchable-now-distill-on-demand"
    assert create_body["metadata"]["sync_reason"] == "history_sync"
    assert create_body["metadata"]["agent_id"] == "PiHistoryAgent"
    assert create_body["metadata"]["host_agent_id"] == "slock:PiHistoryAgent"
    assert create_body["project"] == "/tmp/pi-history-project"
    assert create_body["workspace"] == "/tmp/pi-history-project"
    assert [message["content"] for message in create_body["messages"]] == [
        "history user message",
        "history assistant message",
    ]
    assert all(message["metadata"]["source_app"] == "pi" for message in create_body["messages"])
    assert append_body["deduplicate"] is True
    assert append_body["space_id"] == "pi-history-space"
    assert append_body["historical_import"] is True
    assert append_body["analysis"] == "searchable-now-distill-on-demand"
    assert append_body["idempotency_key"] == "pi:history:History Session/One:2"


def test_registry_connect_contract_points_agent_prompts_to_universal_skill():
    registry = _read_json(COMMUNITY_ROOT / "integrations.json")
    connect = registry["connect"]
    integrations = registry["integrations"]
    integration_ids = {entry["id"] for entry in integrations}

    assert connect["skillUrl"] == "https://mem.nowledge.co/SKILL.md"
    assert "https://mem.nowledge.co/SKILL.md" in connect["prompt"]
    assert "https://mem.nowledge.co/SKILL.md" in connect["promptZh"]
    assert set(connect["appliesTo"]) <= integration_ids
    assert set(connect["doesNotApplyTo"]) <= integration_ids

    agent_guide_entries = [
        entry for entry in integrations if entry.get("install", {}).get("agentGuide")
    ]
    assert agent_guide_entries
    for entry in agent_guide_entries:
        guide = entry["install"]["agentGuide"]
        assert "https://mem.nowledge.co/SKILL.md" in guide["prompt"], entry["id"]
        assert "https://mem.nowledge.co/SKILL.md" in guide["promptZh"], entry["id"]
        assert "Context Bundle or Working Memory check" in guide["prompt"], entry["id"]
        assert "Context Bundle 或 Working Memory 检查" in guide["promptZh"], entry["id"]
        assert "/docs/integrations/" not in guide["prompt"], entry["id"]
        assert "/docs/integrations/" not in guide["promptZh"], entry["id"]

    by_id = {entry["id"]: entry for entry in integrations}
    assert by_id["copilot-cli"]["version"] == "0.1.3"
    assert by_id["gemini-cli"]["version"] == "0.1.9"
    assert by_id["cursor"]["version"] == "0.1.6"
    assert by_id["droid"]["version"] == "0.1.1"
    assert by_id["openclaw"]["version"] == "0.8.26"
    assert by_id["proma"]["version"] == "0.1.1"
    assert by_id["opencode"]["version"] == "0.3.4"
    assert by_id["pi"]["version"] == "0.8.1"
    assert by_id["pi"]["threadSave"]["method"] == "plugin-capture"
    assert by_id["pi"]["capabilities"]["autoCapture"] is True
    assert by_id["pi"]["autonomy"]["threads"] == "automatic-capture"
    assert "nowledge_mem_context_bundle" in by_id["opencode"]["toolNaming"]["tools"]


def test_save_surfaces_do_not_default_omitted_unit_type_to_fact():
    bub_tools = (
        BUB_PLUGIN / "src" / "nowledge_mem_bub" / "tools.py"
    ).read_text(encoding="utf-8")
    assert "unit_type: str | None = Field(" in bub_tools
    assert "unit_type: str = Field(" not in bub_tools
    assert "Omit when unsure so Nowledge Mem can" in bub_tools
    assert "unit_type=param.unit_type" in bub_tools

    bench_client = (
        BENCH_PACKAGE / "src" / "nmem_bench" / "nmem" / "client.py"
    ).read_text(encoding="utf-8")
    assert "unit_type: str | None = None" in bench_client
    assert "if unit_type:\n            args.extend([\"--unit-type\", unit_type])" in bench_client


def test_claude_read_hooks_keep_file_fallback_without_plugin_root(tmp_path):
    hooks = _read_json(CLAUDE_PLUGIN / "hooks" / "hooks.json")["hooks"]
    home = tmp_path / "home"
    memory_file = home / "ai-now" / "memory.md"
    memory_file.parent.mkdir(parents=True)
    memory_file.write_text("fallback briefing\n", encoding="utf-8")

    env = {
        "HOME": str(home),
        "PATH": "/bin:/usr/bin",
        "CLAUDE_PLUGIN_ROOT": "",
    }
    startup_command = hooks["SessionStart"][0]["hooks"][0]["command"]
    startup = subprocess.run(
        ["/bin/sh", "-c", startup_command],
        env=env,
        text=True,
        capture_output=True,
        timeout=15,
    )
    assert startup.returncode == 0
    assert startup.stdout.strip() == "fallback briefing"

    compact_command = hooks["SessionStart"][1]["hooks"][0]["command"]
    compact = subprocess.run(
        ["/bin/sh", "-c", compact_command],
        env=env,
        text=True,
        capture_output=True,
        timeout=15,
    )
    assert compact.returncode == 0
    assert "fallback briefing" in compact.stdout
    assert "Context was compacted" in compact.stdout


def test_key_plugin_credentials_stay_out_of_static_runtime_urls():
    hermes_client = (HERMES_PLUGIN / "client.py").read_text(encoding="utf-8").lower()
    openclaw_client = (OPENCLAW_PLUGIN / "src" / "client.js").read_text(encoding="utf-8").lower()
    assert "nmem_api_key=" not in hermes_client
    assert "nmem_api_key=" not in openclaw_client
    assert "Authorization" not in (CODEX_PLUGIN / ".mcp.json").read_text(encoding="utf-8")


@pytest.mark.skipif(_skip_live_host("pi"), reason="Pi live E2E not requested")
def test_pi_live_package_install_and_extension_smoke(tmp_path: Path):
    _require_live_host("pi")
    if shutil.which("bun") is None:
        raise AssertionError("Pi extension smoke requires bun on PATH")

    agent_dir = tmp_path / "pi-agent"
    env = os.environ.copy()
    env["PI_CODING_AGENT_DIR"] = str(agent_dir)
    _run(["pi", "install", str(PI_PLUGIN), "--no-approve"], env=env, timeout=60)
    listing = _run(["pi", "list", "--no-approve"], env=env, timeout=30)
    assert str(PI_PLUGIN) in listing.stdout

    script = dedent(
        """
        import http from "node:http";

        const { default: nowledgeMemPi } = await import(process.env.PI_EXTENSION_URL);
        const calls = [];
        const server = http.createServer((req, res) => {
          let raw = "";
          req.on("data", (chunk) => raw += chunk);
          req.on("end", () => {
            calls.push({
              method: req.method,
              url: req.url,
              body: raw ? JSON.parse(raw) : {},
            });
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          });
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const { port } = server.address();
        process.env.NMEM_API_URL = `http://127.0.0.1:${port}`;
        process.env.NMEM_SPACE = "pi-smoke-space";
        process.env.NMEM_AGENT_ID = "PiSmokeAgent";
        process.env.NMEM_HOST_AGENT_ID = "slock:PiSmokeAgent";

        const handlers = new Map();
        nowledgeMemPi({ on(event, handler) { handlers.set(event, handler); } });
        const entries = [
          {
            id: "u1",
            type: "message",
            timestamp: "2026-06-10T00:00:00Z",
            message: { role: "user", content: "nmem-pi-smoke user" },
          },
          {
            id: "c1",
            type: "message",
            timestamp: "2026-06-10T00:00:01Z",
            message: { role: "custom", content: "context bundle should not sync" },
          },
          {
            id: "a1",
            type: "message",
            timestamp: "2026-06-10T00:00:02Z",
            message: { role: "assistant", content: "nmem-pi-smoke assistant" },
          },
        ];
        const manager = {
          getBranch: () => entries,
          getSessionId: () => "Smoke Session/One",
          getSessionName: () => "Pi Smoke Thread",
          getCwd: () => "/tmp/pi-smoke",
          getSessionFile: () => "/tmp/pi-smoke/session.jsonl",
        };
        let stale = false;
        const ctx = {
          get sessionManager() {
            if (stale) throw new Error("stale ctx accessed after scheduled agent_end");
            return manager;
          },
        };
        await handlers.get("agent_end")?.({ type: "agent_end" }, ctx);
        stale = true;
        await new Promise((resolve) => setTimeout(resolve, 1100));
        await handlers.get("session_before_switch")?.(
          { type: "session_before_switch", reason: "new" },
          { sessionManager: manager },
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
        server.close();

        if (calls.length !== 2) throw new Error(`expected 2 calls, got ${calls.length}`);
        const [create, append] = calls;
        if (create.url !== "/threads") throw new Error(`bad create url ${create.url}`);
        if (!append.url.includes("/threads/pi-smoke-session-one/append")) {
          throw new Error(`bad append url ${append.url}`);
        }
        if (create.body.source !== "pi") throw new Error("missing pi source");
        if (create.body.space_id !== "pi-smoke-space" || append.body.space_id !== "pi-smoke-space") {
          throw new Error("space not propagated");
        }
        if (create.body.metadata.agent_id !== "PiSmokeAgent") throw new Error("agent_id missing");
        if (create.body.metadata.host_agent_id !== "slock:PiSmokeAgent") {
          throw new Error("host_agent_id missing");
        }
        if (create.body.messages.length !== 2) {
          throw new Error(`custom message leaked or messages missing: ${create.body.messages.length}`);
        }
        if (!create.body.messages.every((msg) => msg.metadata?.source_app === "pi")) {
          throw new Error("message source_app missing");
        }
        if (append.body.deduplicate !== true) throw new Error("append deduplicate missing");
        console.log(JSON.stringify({ ok: true, calls: calls.length }));
        """
    )
    smoke_env = env.copy()
    smoke_env["PI_EXTENSION_URL"] = (PI_PLUGIN / "extensions" / "nowledge-mem.ts").resolve().as_uri()
    result = _run(["bun", "--eval", script], env=smoke_env, timeout=30)
    assert '"ok":true' in result.stdout.replace(" ", "")


@pytest.mark.skipif(_skip_live_host("claude"), reason="Claude live E2E not requested")
def test_claude_code_live_thread_capture(e2e_context: E2EContext, tmp_path: Path):
    _require_live_host("claude")
    workspace = tmp_path / e2e_context.space
    workspace.mkdir()
    _run(["git", "init", "-q"], cwd=workspace, env=e2e_context.env, timeout=30)

    session_id = str(uuid.uuid4())
    prompt = f"Reply with exactly: done {e2e_context.marker}"
    command = [
        "claude",
        "-p",
        prompt,
        "--plugin-dir",
        str(CLAUDE_PLUGIN),
        "--session-id",
        session_id,
        "--output-format",
        "stream-json",
        "--include-hook-events",
        "--verbose",
        "--permission-mode",
        "dontAsk",
        "--max-budget-usd",
        os.environ.get("NMEM_E2E_CLAUDE_MAX_BUDGET_USD", "0.05"),
    ]
    if os.environ.get("NMEM_E2E_CLAUDE_MODEL"):
        command.extend(["--model", os.environ["NMEM_E2E_CLAUDE_MODEL"]])

    result = subprocess.run(
        command,
        cwd=str(workspace),
        env=e2e_context.env,
        text=True,
        capture_output=True,
        timeout=180,
    )
    combined = result.stdout + result.stderr
    if result.returncode != 0 and not (
        e2e_context.marker in combined and "error_max_budget_usd" in combined
    ):
        raise AssertionError(
            "command failed\n"
            f"cmd: {' '.join(command)}\n"
            f"exit: {result.returncode}\n"
            f"stdout:\n{result.stdout[-4000:]}\n"
            f"stderr:\n{result.stderr[-4000:]}"
        )
    assert e2e_context.marker in result.stdout

    # Claude --print gives us deterministic CI-friendly transcript generation,
    # but it does not reliably emit the interactive Stop lifecycle event. Invoke
    # the same save script with Claude's hook payload shape against the real
    # session transcript, with NMEM_SPACE removed so Git cwd resolution is tested.
    hook_env = e2e_context.env.copy()
    hook_env.pop("NMEM_SPACE", None)
    hook_env.pop("NMEM_SPACE_ID", None)
    hook_payload = json.dumps({"session_id": session_id, "cwd": str(workspace)})
    hook_result = subprocess.run(
        [
            "python3",
            str(CLAUDE_PLUGIN / "scripts" / "nmem-hook-save.py"),
            "--event",
            "stop",
        ],
        cwd=str(workspace),
        env=hook_env,
        input=hook_payload,
        text=True,
        capture_output=True,
        timeout=45,
    )
    if hook_result.returncode != 0:
        raise AssertionError(
            "Claude hook save command failed\n"
            f"exit: {hook_result.returncode}\n"
            f"stdout:\n{hook_result.stdout[-4000:]}\n"
            f"stderr:\n{hook_result.stderr[-4000:]}"
        )

    _poll_thread(
        marker=e2e_context.marker,
        source="claude-code",
        space=e2e_context.space,
        env=e2e_context.env,
    )


@pytest.mark.skipif(_skip_live_host("codex"), reason="Codex live E2E not requested")
def test_codex_live_stop_hook_thread_capture(e2e_context: E2EContext, tmp_path: Path):
    _require_live_host("codex")
    workspace = tmp_path / "codex-workspace"
    codex_home = tmp_path / "codex-home"
    codex_home.mkdir()
    source_codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")).expanduser()
    for name in ("auth.json", "config.toml", "installation_id", "version.json"):
        source_file = source_codex_home / name
        if source_file.exists():
            shutil.copy2(source_file, codex_home / name)
    codex_env = e2e_context.env.copy()
    codex_env["CODEX_HOME"] = str(codex_home)

    (workspace / ".agents" / "plugins").mkdir(parents=True)
    shutil.copytree(
        CODEX_PLUGIN,
        workspace / ".agents" / "nowledge-mem",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    (workspace / ".agents" / "plugins" / "marketplace.json").write_text(
        json.dumps(
            {
                "name": "local",
                "plugins": [
                    {
                        "name": "nowledge-mem",
                        "source": {"source": "local", "path": "./.agents/nowledge-mem"},
                        "policy": {
                            "installation": "INSTALLED_BY_DEFAULT",
                            "authentication": "ON_INSTALL",
                        },
                        "category": "Productivity",
                    }
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    (workspace / "AGENTS.md").write_text(
        "Use the Nowledge Mem plugin when the user asks to recall memory. Do not manually save this test thread.\n",
        encoding="utf-8",
    )
    _run(
        ["python3", str(workspace / ".agents" / "nowledge-mem" / "scripts" / "install_hooks.py")],
        env=codex_env,
        timeout=30,
    )
    codex_config = (codex_home / "config.toml").read_text(encoding="utf-8")
    assert "hooks = true" in codex_config
    assert "plugin_hooks = true" in codex_config
    assert "nowledge-mem@nowledge-community:hooks/hooks.json:stop:0:0" in codex_config
    assert "nowledge-mem@local:hooks/hooks.json:stop:0:0" in codex_config

    prompt = (
        f"This is a Nowledge Mem integration test marker {e2e_context.marker}. "
        "Do not call any Nowledge Mem save-thread skill or nmem command. "
        f"Just reply exactly: done {e2e_context.marker}"
    )
    command = [
        "codex",
        "exec",
        "-C",
        str(workspace),
        "--skip-git-repo-check",
        "--json",
        "--enable",
        "plugins",
        "--enable",
        "hooks",
        "--enable",
        "plugin_hooks",
        "-c",
        'plugins."nowledge-mem@local".enabled=true',
    ]
    if os.environ.get("NMEM_E2E_CODEX_MODEL"):
        command.extend(["--model", os.environ["NMEM_E2E_CODEX_MODEL"]])
    command.append(prompt)

    result = _run(command, env=codex_env, timeout=240)
    assert e2e_context.marker in result.stdout
    try:
        _poll_thread(
            marker=e2e_context.marker,
            source="codex",
            space=e2e_context.space,
            env=e2e_context.env,
            timeout_seconds=12,
        )
        return
    except AssertionError as automatic_error:
        # Current Codex app-server/exec builds can expose plugin hooks without
        # firing Stop hooks in this non-interactive harness. Keep the live test
        # valuable by replaying the exact hook payload against the real
        # transcript Codex just wrote, which verifies the package setup,
        # nmem/API path, parser, and dedupe guard.
        transcript = _latest_codex_transcript(codex_home)
        meta = _codex_transcript_meta(transcript)
        hook_payload = json.dumps(
            {
                "session_id": meta.get("id"),
                "cwd": str(workspace),
                "transcript_path": str(transcript),
                "hook_event_name": "Stop",
            }
        )
        hook_result = subprocess.run(
            ["python3", str(codex_home / "hooks" / "nowledge-mem-stop-save.py"), "--event", "stop"],
            cwd=str(workspace),
            env=codex_env,
            input=hook_payload,
            text=True,
            capture_output=True,
            timeout=45,
        )
        if hook_result.returncode != 0:
            raise AssertionError(
                "Codex Stop hook did not run automatically in codex exec, and manual replay failed\n"
                f"automatic poll: {automatic_error}\n"
                f"exit: {hook_result.returncode}\n"
                f"stdout:\n{hook_result.stdout[-4000:]}\n"
                f"stderr:\n{hook_result.stderr[-4000:]}"
            ) from automatic_error

    _poll_thread(
        marker=e2e_context.marker,
        source="codex",
        space=e2e_context.space,
        env=e2e_context.env,
    )


@pytest.mark.skipif(_skip_live_host("openclaw"), reason="OpenClaw live E2E not requested")
def test_openclaw_live_hooks_and_context_engine_capture(e2e_context: E2EContext, tmp_path: Path):
    _require_live_host("openclaw")
    profile = os.environ.get("NMEM_E2E_OPENCLAW_PROFILE")
    base = ["openclaw", "--profile", profile] if profile else ["openclaw"]
    plugin_copy = tmp_path / "openclaw-nowledge-mem"
    shutil.copytree(
        OPENCLAW_PLUGIN,
        plugin_copy,
        ignore=shutil.ignore_patterns(
            ".git",
            "node_modules",
            "tests",
            "coverage",
            "dist",
            "*.log",
        ),
    )
    # OpenClaw profiles isolate config selection, but plugin installs and
    # install records live under the OpenClaw state dir. Never let this live E2E
    # rewrite the maintainer's real ~/.openclaw/extensions or plugins.installs.
    real_state = Path(os.environ.get("NMEM_E2E_OPENCLAW_SOURCE_STATE", Path.home() / ".openclaw"))
    isolated_home = tmp_path / "openclaw-home"
    isolated_state = isolated_home / ".openclaw"
    isolated_state.mkdir(parents=True)
    real_config = real_state / "openclaw.json"
    isolated_config = isolated_state / "openclaw.json"
    if real_config.exists():
        shutil.copy2(real_config, isolated_config)
    else:
        isolated_config.write_text("{}", encoding="utf-8")
    for dirname in ("agents", "credentials", "identity"):
        source = real_state / dirname
        if source.exists():
            shutil.copytree(source, isolated_state / dirname, dirs_exist_ok=True)
    host_env = {
        **e2e_context.env,
        "OPENCLAW_HOME": str(isolated_home),
        "OPENCLAW_STATE_DIR": str(isolated_state),
        "OPENCLAW_CONFIG_PATH": str(isolated_config),
    }
    config_ops: list[dict[str, Any]] = [
        {"path": "plugins.entries.openclaw-nowledge-mem.enabled", "value": True},
        {"path": "plugins.entries.openclaw-nowledge-mem.config.sessionDigest", "value": True},
        {"path": "plugins.entries.openclaw-nowledge-mem.config.sessionContext", "value": True},
        {"path": "plugins.entries.openclaw-nowledge-mem.config.space", "value": e2e_context.space},
        {"path": "plugins.slots.contextEngine", "value": "nowledge-mem"},
    ]
    if os.environ.get("NMEM_E2E_API_URL"):
        config_ops.append(
            {
                "path": "plugins.entries.openclaw-nowledge-mem.config.apiUrl",
                "value": os.environ["NMEM_E2E_API_URL"],
            }
        )
    if os.environ.get("NMEM_E2E_API_KEY"):
        config_ops.append(
            {
                "path": "plugins.entries.openclaw-nowledge-mem.config.apiKey",
                "value": os.environ["NMEM_E2E_API_KEY"],
            }
        )
    if os.environ.get("NMEM_E2E_OPENCLAW_MODEL"):
        config_ops.append({"path": "agents.defaults.model.primary", "value": os.environ["NMEM_E2E_OPENCLAW_MODEL"]})
    batch_file = tmp_path / "openclaw-config.json"
    batch_file.write_text(json.dumps(config_ops), encoding="utf-8")

    # Install a package-shaped copy with --force so the safety scanner sees what
    # users receive from npm/ClawHub instead of checkout-only test fixtures.
    _run([*base, "plugins", "install", str(plugin_copy), "--force"], env=host_env, timeout=120)
    _run([*base, "config", "set", "--batch-file", str(batch_file)], env=host_env, timeout=60)

    prompt = f"Reply with exactly: done {e2e_context.marker}"
    _run(
        [
            *base,
            "agent",
            "--local",
            "--session-id",
            f"nmem-e2e-{e2e_context.run_id}",
            "--message",
            prompt,
            "--json",
            "--timeout",
            os.environ.get("NMEM_E2E_OPENCLAW_TIMEOUT_SECONDS", "180"),
        ],
        env=host_env,
        timeout=int(os.environ.get("NMEM_E2E_OPENCLAW_TIMEOUT_SECONDS", "180")) + 30,
    )
    _poll_thread(
        marker=e2e_context.marker,
        source="openclaw",
        space=e2e_context.space,
        env=e2e_context.env,
    )


@pytest.mark.skipif(_skip_live_host("hermes"), reason="Hermes live E2E not requested")
def test_hermes_live_provider_hooks_capture(e2e_context: E2EContext, tmp_path: Path):
    _require_live_host("hermes")
    hermes_home = tmp_path / "hermes-home"
    hermes_home.mkdir()
    real_hermes_home = Path(
        os.environ.get("NMEM_E2E_HERMES_SOURCE_HOME", Path.home() / ".hermes")
    )
    for credential_file in (".env", "auth.json"):
        source = real_hermes_home / credential_file
        if source.exists():
            shutil.copy2(source, hermes_home / credential_file)

    env = e2e_context.env.copy()
    env["HERMES_HOME"] = str(hermes_home)

    _run(["bash", str(HERMES_PLUGIN / "setup.sh"), "--plugin"], env=env, timeout=60)
    (hermes_home / "nowledge-mem.json").write_text(
        json.dumps({"space": e2e_context.space, "timeout": 30}, indent=2),
        encoding="utf-8",
    )

    command = [
        "hermes",
        "chat",
        "-q",
        f"Reply with exactly: done {e2e_context.marker}",
        "--quiet",
        "--pass-session-id",
        "--source",
        "nmem-e2e",
        "--max-turns",
        os.environ.get("NMEM_E2E_HERMES_MAX_TURNS", "10"),
    ]
    if os.environ.get("NMEM_E2E_HERMES_PROVIDER"):
        command.extend(["--provider", os.environ["NMEM_E2E_HERMES_PROVIDER"]])
    if os.environ.get("NMEM_E2E_HERMES_MODEL"):
        command.extend(["--model", os.environ["NMEM_E2E_HERMES_MODEL"]])

    result = _run(command, env=env, timeout=240)
    assert e2e_context.marker in result.stdout
    _poll_thread(
        marker=e2e_context.marker,
        source="hermes",
        space=e2e_context.space,
        env=env,
    )


@pytest.mark.skipif(_skip_live_host("opencode"), reason="OpenCode live E2E not requested")
def test_opencode_live_tool_thread_capture(e2e_context: E2EContext, tmp_path: Path):
    _require_live_host("opencode")
    workspace = tmp_path / "opencode-workspace"
    workspace.mkdir()
    plugin_copy = tmp_path / "opencode-nowledge-mem"
    shutil.copytree(
        OPENCODE_PLUGIN,
        plugin_copy,
        ignore=shutil.ignore_patterns(".git", "node_modules", "coverage", "dist", "*.log"),
    )
    plugin_dependency = Path.home() / ".config" / "opencode" / "node_modules" / "@opencode-ai" / "plugin"
    if not plugin_dependency.exists():
        raise AssertionError(
            "OpenCode local plugin smoke requires @opencode-ai/plugin in ~/.config/opencode/node_modules. "
            "Run any OpenCode command once or install the plugin dependency before using a checkout path."
        )
    dependency_target = plugin_copy / "node_modules" / "@opencode-ai"
    dependency_target.mkdir(parents=True)
    (dependency_target / "plugin").symlink_to(plugin_dependency)

    env = e2e_context.env.copy()
    env["OPENCODE_CONFIG_CONTENT"] = json.dumps({"plugin": [str(plugin_copy)]})
    model = os.environ.get("NMEM_E2E_OPENCODE_MODEL", "opencode/minimax-m2.5-free")
    prompt = (
        f"Nowledge Mem OpenCode integration test marker {e2e_context.marker}. "
        "First call the nowledge_mem_status tool. "
        f"Then call the nowledge_mem_save_thread tool with summary 'OpenCode e2e {e2e_context.marker}'. "
        f"Then reply exactly: done {e2e_context.marker}"
    )
    result = _run(
        [
            "opencode",
            "run",
            "--dir",
            str(workspace),
            "--model",
            model,
            "--format",
            "json",
            prompt,
        ],
        env=env,
        timeout=int(os.environ.get("NMEM_E2E_OPENCODE_TIMEOUT_SECONDS", "360")),
    )
    assert e2e_context.marker in result.stdout
    assert '"tool":"nowledge_mem_status"' in result.stdout
    assert '"tool":"nowledge_mem_save_thread"' in result.stdout
    assert "Session capture failed" not in result.stdout
    assert "No messages found" not in result.stdout
    _poll_thread(
        marker=e2e_context.marker,
        source="opencode",
        space=e2e_context.space,
        env=env,
    )
