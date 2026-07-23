from __future__ import annotations

import json
import importlib.util
import os
import shutil
import subprocess
import sys
import threading
import time
import tomllib
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
OMP_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-omp-plugin"
KIMI_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-kimi-code-plugin"
KIMI_WORK_CONNECTOR = COMMUNITY_ROOT / "nowledge-mem-kimi-work-connector"
BUB_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-bub-plugin"
CODEBUDDY_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-codebuddy-plugin"
BENCH_PACKAGE = COMMUNITY_ROOT / "nowledge-mem-bench"
ALMA_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-alma-plugin"
KEY_HOSTS = {"claude", "codex", "openclaw", "hermes", "opencode", "pi"}


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_python_module(path: Path, name: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise AssertionError(f"could not load module spec for {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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


def _codex_requires_legacy_plugin_hooks(env: dict[str, str]) -> bool:
    result = subprocess.run(
        ["codex", "features", "list"],
        env=env,
        text=True,
        capture_output=True,
        timeout=15,
        check=False,
    )
    if result.returncode != 0:
        return True
    for line in result.stdout.splitlines():
        fields = line.split()
        if fields and fields[0] == "plugin_hooks":
            return len(fields) < 2 or fields[1].lower() != "removed"
    return True


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
    registry_by_id = {item["id"]: item for item in registry["integrations"] if item.get("id")}
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
    assert historical_commands["hermes"] == "nmem t sync --from hermes"

    marketplace_files = [
        COMMUNITY_ROOT / ".agents" / "plugins" / "marketplace.json",
        COMMUNITY_ROOT / ".claude-plugin" / "marketplace.json",
        COMMUNITY_ROOT / ".cursor-plugin" / "marketplace.json",
        COMMUNITY_ROOT / ".factory-plugin" / "marketplace.json",
        COMMUNITY_ROOT / ".github" / "plugin" / "marketplace.json",
    ]
    for marketplace_file in marketplace_files:
        marketplace_text = marketplace_file.read_text(encoding="utf-8")
        assert "git@github.com" not in marketplace_text
        assert "ssh://git@github.com" not in marketplace_text
        assert "github.com:" not in marketplace_text

    claude_marketplace = _read_json(COMMUNITY_ROOT / ".claude-plugin" / "marketplace.json")
    claude_marketplace_plugin = next(
        plugin for plugin in claude_marketplace["plugins"] if plugin.get("name") == "nowledge-mem"
    )
    copilot_marketplace = _read_json(COMMUNITY_ROOT / ".github" / "plugin" / "marketplace.json")
    copilot_marketplace_plugin = next(
        plugin for plugin in copilot_marketplace["plugins"] if plugin.get("name") == "nowledge-mem"
    )
    for plugin in claude_marketplace["plugins"]:
        source = plugin.get("source", {})
        if source.get("source") == "git-subdir":
            assert source["url"].startswith("https://github.com/")

    claude_manifest = _read_json(CLAUDE_PLUGIN / ".claude-plugin" / "plugin.json")
    claude_hooks = _read_json(CLAUDE_PLUGIN / "hooks" / "hooks.json")["hooks"]
    claude_save_hook = (CLAUDE_PLUGIN / "scripts" / "nmem-hook-save.py").read_text(encoding="utf-8")
    claude_read_skill = (CLAUDE_PLUGIN / "skills" / "read-working-memory" / "SKILL.md").read_text(encoding="utf-8")
    claude_search_skill = (CLAUDE_PLUGIN / "skills" / "search-memory" / "SKILL.md").read_text(encoding="utf-8")
    assert claude_manifest["name"] == "nowledge-mem"
    assert claude_manifest["version"] == "0.7.18"
    assert claude_marketplace_plugin["version"] == claude_manifest["version"]
    assert registry_by_id["claude-code"]["version"] == claude_manifest["version"]
    assert registry_by_id["grok"]["version"] == claude_manifest["version"]
    assert {"SessionStart", "UserPromptSubmit", "PreCompact", "Stop"} <= set(claude_hooks)
    assert "nmem-hook-read.sh" in json.dumps(claude_hooks)
    assert "nmem-hook-save.py" in json.dumps(claude_hooks)
    assert "find_skills" in json.dumps(claude_hooks)
    assert "CREATE_NO_WINDOW" in claude_save_hook
    assert "extract_skill_outcomes_from_file" in claude_save_hook
    assert "wm read" not in json.dumps(claude_hooks)
    assert (CLAUDE_PLUGIN / "scripts" / "nmem-hook-read.sh").exists()
    assert (CLAUDE_PLUGIN / "scripts" / "skill_outcome.py").exists()
    assert (CLAUDE_PLUGIN / "skills" / "save-thread" / "SKILL.md").exists()
    assert "Never infer a space from the current folder" in claude_read_skill
    assert "Never infer a space from the current folder" in claude_search_skill

    codex_manifest = _read_json(CODEX_PLUGIN / ".codex-plugin" / "plugin.json")
    codex_mcp = _read_json(CODEX_PLUGIN / ".mcp.json")
    codex_hooks = _read_json(CODEX_PLUGIN / "hooks" / "hooks.json")["hooks"]
    codex_save_hook = (CODEX_PLUGIN / "hooks" / "nmem-stop-save.py").read_text(encoding="utf-8")
    codex_runtime = (CODEX_PLUGIN / "hooks" / "nmem_runtime.py").read_text(encoding="utf-8")
    assert codex_manifest["name"] == "nowledge-mem"
    assert codex_manifest["version"] == "0.1.28"
    assert registry_by_id["codex-cli"]["version"] == codex_manifest["version"]
    assert codex_manifest["skills"] == "./skills/"
    assert codex_manifest["mcpServers"] == "./.mcp.json"
    assert codex_manifest["hooks"] == "./hooks/hooks.json"
    assert codex_mcp["mcpServers"]["nowledge-mem"]["type"] == "http"
    assert {"SessionStart", "UserPromptSubmit", "Stop"} <= set(codex_hooks)
    assert "nmem-context.py" in json.dumps(codex_hooks["SessionStart"])
    assert "nmem-context.py" in json.dumps(codex_hooks["UserPromptSubmit"])
    assert (CODEX_PLUGIN / "hooks" / "nmem-context.py").exists()
    assert (CODEX_PLUGIN / "hooks" / "nmem_runtime.py").exists()
    assert "nmem-stop-launch.py" in json.dumps(codex_hooks)
    codex_launcher = (CODEX_PLUGIN / "hooks" / "nmem-stop-launch.py").read_text(encoding="utf-8")
    assert "nowledge-mem-stop-save.py" in codex_launcher
    assert "nmem-stop-save.py" in codex_launcher
    assert "extract_skill_outcomes_from_file" in codex_save_hook
    assert "DELEGATED_CONVERSATION_ORIGINATORS" in codex_save_hook
    assert (CODEX_PLUGIN / "hooks" / "skill_outcome.py").exists()
    codex_stop_commands = [
        hook.get("command", "")
        for entry in codex_hooks.get("Stop", [])
        if isinstance(entry, dict)
        for hook in entry.get("hooks", [])
        if isinstance(hook, dict)
    ]
    assert any("os.environ['PLUGIN_ROOT']" in command for command in codex_stop_commands)
    assert any("nmem-stop-launch.py" in command for command in codex_stop_commands)
    assert any('python3 -c "import os, runpy, sys' in command for command in codex_stop_commands)
    assert any('python -c "import os, runpy, sys' in command for command in codex_stop_commands)
    assert all("${PLUGIN_ROOT}" not in command for command in codex_stop_commands)
    assert all("%PLUGIN_ROOT%" not in command for command in codex_stop_commands)
    assert all("if [" not in command for command in codex_stop_commands)
    assert all("$HOME/.codex/hooks/nowledge-mem-stop-save.py" not in command for command in codex_stop_commands)
    codex_windows_commands = [
        hook.get("commandWindows", "")
        for entry in codex_hooks.get("Stop", [])
        if isinstance(entry, dict)
        for hook in entry.get("hooks", [])
        if isinstance(hook, dict)
    ]
    assert all("${PLUGIN_ROOT}" not in command for command in codex_windows_commands)
    assert all("%PLUGIN_ROOT%" not in command for command in codex_windows_commands)
    assert any("os.environ['PLUGIN_ROOT']" in command for command in codex_windows_commands)
    assert any('python -c "import os, runpy, sys' in command for command in codex_windows_commands)
    assert any('py -3 -c "import os, runpy, sys' in command for command in codex_windows_commands)
    assert any('python3 -c "import os, runpy, sys' in command for command in codex_windows_commands)
    assert (CODEX_PLUGIN / "scripts" / "install_hooks.py").exists()
    assert (CODEX_PLUGIN / "skills" / "working-memory" / "SKILL.md").exists()
    assert (CODEX_PLUGIN / "skills" / "save-thread" / "SKILL.md").exists()
    assert "from nmem_runtime import" in codex_save_hook
    assert "CREATE_NO_WINDOW" in codex_runtime

    openclaw_manifest = _read_json(OPENCLAW_PLUGIN / "openclaw.plugin.json")
    openclaw_pkg = _read_json(OPENCLAW_PLUGIN / "package.json")
    openclaw_client = (OPENCLAW_PLUGIN / "src" / "client.js").read_text(encoding="utf-8")
    openclaw_spawn_env = (OPENCLAW_PLUGIN / "src" / "spawn-env.js").read_text(encoding="utf-8")
    openclaw_context_tool = (OPENCLAW_PLUGIN / "src" / "tools" / "context.js").read_text(encoding="utf-8")
    schema = openclaw_manifest["configSchema"]["properties"]
    assert openclaw_manifest["version"] == "0.8.31"
    assert openclaw_pkg["version"] == "0.8.31"
    assert openclaw_manifest["kind"] == ["memory", "context-engine"]
    assert openclaw_manifest["contracts"]["tools"] == [
        "memory_search",
        "memory_get",
        "nowledge_mem_save",
        "nowledge_mem_context",
        "nowledge_mem_connections",
        "nowledge_mem_timeline",
        "nowledge_mem_forget",
        "nowledge_mem_thread_search",
        "nowledge_mem_thread_fetch",
        "nowledge_mem_status",
    ]
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
    hermes_version = next(
        line.removeprefix("version:").strip()
        for line in hermes_manifest.splitlines()
        if line.startswith("version:")
    )
    assert "name: nowledge-mem" in hermes_manifest
    assert "version: 0.5.23" in hermes_manifest
    assert registry_by_id["hermes"]["version"] == hermes_version
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
    assert (HERMES_PLUGIN / "skill_outcome.py").exists()

    opencode_pkg = _read_json(OPENCODE_PLUGIN / "package.json")
    opencode_source = (OPENCODE_PLUGIN / "src" / "index.ts").read_text(encoding="utf-8")
    assert opencode_pkg["name"] == "opencode-nowledge-mem"
    assert opencode_pkg["version"] == "0.3.5"
    assert registry_by_id["opencode"]["version"] == opencode_pkg["version"]
    assert registry_by_id["opencode"]["capabilities"]["autoCapture"] is True
    assert registry_by_id["opencode"]["autonomy"]["threads"] == "automatic-capture"
    assert "fetchSessionMessages" in opencode_source
    assert "path: { id: ctx.sessionID }" in opencode_source
    assert "nowledge_mem_context_bundle" in opencode_source
    assert 'nmem(["context", "--source-app", "opencode"])' in opencode_source
    assert '"--source", "opencode"' in opencode_source
    assert "withAmbientSpaceArg(args)" in opencode_source
    assert "ambientAgentId" in opencode_source
    assert "ambientHostAgentId" in opencode_source
    assert "NMEM_AGENT_ID" in opencode_source
    assert "NMEM_HOST_AGENT_ID" in opencode_source
    assert '["context", "ctx", "wm", "m", "memories", "t", "threads"]' in opencode_source
    assert "nowledge_mem_save_thread" in opencode_source
    assert "event: async ({ event })" in opencode_source
    assert 'event.type === "session.status"' in opencode_source
    assert 'statusType === "idle"' in opencode_source
    assert 'event.type === "session.idle"' in opencode_source
    assert "syncSessionThread" in opencode_source
    assert "idempotency_key: `opencode:live:${ctx.sessionID}`" in opencode_source

    copilot_manifest = _read_json(COPILOT_PLUGIN / ".claude-plugin" / "plugin.json")
    copilot_hooks = _read_json(COPILOT_PLUGIN / "hooks" / "hooks.json")
    copilot_capture = (COPILOT_PLUGIN / "hooks" / "copilot-stop-save.py").read_text(encoding="utf-8")
    assert copilot_manifest["version"] == "0.1.4"
    assert copilot_marketplace_plugin["version"] == copilot_manifest["version"]
    assert registry_by_id["copilot-cli"]["version"] == copilot_manifest["version"]
    assert "--source-app copilot-cli" in json.dumps(copilot_hooks)
    assert "NMEM_AGENT_ID" in json.dumps(copilot_hooks)
    assert "NMEM_HOST_AGENT_ID" in json.dumps(copilot_hooks)
    assert "rendered_markdown" in json.dumps(copilot_hooks)
    assert "wm read" in json.dumps(copilot_hooks)
    assert "CREATE_NO_WINDOW" in copilot_capture

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
    proma_save_hook = (PROMA_PLUGIN / "hooks" / "save-to-nmem.py").read_text(encoding="utf-8")
    proma_hooks = _read_json(PROMA_PLUGIN / "hooks" / "hooks.json")
    assert proma_manifest["version"] == "0.1.4"
    assert proma_hooks["installPath"] == "~/.proma/sdk-config/.claude/settings.json"
    assert proma_hooks["scriptInstallPath"] == "~/.proma/scripts/"
    assert "UserPromptSubmit" in proma_hooks["hooks"]
    assert "asyncRewake" in json.dumps(proma_hooks)
    assert "${PROMA_HOME}" not in json.dumps(proma_hooks)
    assert "$HOME/.proma/scripts/" in json.dumps(proma_hooks)
    assert '"context", "--source-app", "proma"' in proma_hook
    assert "NMEM_AGENT_ID" in proma_hook
    assert "NMEM_HOST_AGENT_ID" in proma_hook
    assert '"wm", "read"' in proma_hook
    assert "CREATE_NO_WINDOW" in proma_hook
    assert "nowledge-mem:start" in proma_hook
    assert "CLAUDE.md" in proma_hook
    assert "sdk-config" in proma_save_hook
    assert "source\": \"proma\"" in proma_save_hook

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
    assert pi_pkg["version"] == "0.8.5"
    assert "./extensions/nowledge-mem.ts" in pi_pkg["pi"]["extensions"]
    assert "./skills" in pi_pkg["pi"]["skills"]
    assert pi_pkg["bin"]["nowledge-mem-pi-sync"] == "./scripts/sync-history.mjs"
    assert "NMEM_PLUGIN_SOURCE_APP" in pi_extension
    assert "NMEM_PLUGIN_HOST_LABEL" in pi_extension
    assert 'pi.on("agent_end"' in pi_extension
    assert 'pi.on("session_shutdown"' in pi_extension
    assert 'pi.on("session_before_switch"' in pi_extension
    assert 'pi.on("session_before_compact"' in pi_extension
    assert 'source: sourceApp()' in pi_extension
    assert 'metadata: {' in pi_extension
    assert "external_id" in pi_extension
    assert "deduplicate: true" in pi_extension
    assert "NMEM_AGENT_ID" in pi_extension
    assert "NMEM_HOST_AGENT_ID" in pi_extension
    assert "custom_message" in pi_extension
    assert "custom" in pi_extension
    assert 'import { execFile } from "node:child_process";' in pi_extension
    assert "LOCAL_WORKING_MEMORY_PATH" in pi_extension
    assert "startupGuidance()" in pi_extension
    assert '["context", "--source-app", sourceApp()]' in pi_extension
    assert '["wm", "read"]' in pi_extension
    assert "rendered_markdown" in pi_extension
    assert "shouldUseLocalWorkingMemoryFallback" in pi_extension
    assert "truncateStartupContext" in pi_extension
    assert 'normalizedId.toLowerCase() !== "unknown"' in pi_extension
    assert "sawReadFailure = true;" in pi_extension
    assert "readFileSync(LOCAL_WORKING_MEMORY_PATH" in pi_extension
    assert "withAmbientNmemArgs" in pi_extension
    assert 'pi.on("session_start"' in pi_extension
    assert 'pi.on("before_agent_start"' in pi_extension
    assert 'pi.on("session_compact"' in pi_extension
    assert "await appendMemoryContext(event.systemPrompt, ctx)" in pi_extension
    assert "startupContextCacheKey" in pi_extension
    assert "evictStartupContext" in pi_extension
    assert "degradedReason" in pi_extension
    assert "quoteWindowsBatchArg" in pi_extension
    assert "rejectWindowsCmdEnvExpansion" in pi_extension
    assert '["/d", "/s", "/c", line]' in pi_extension
    assert "windowsVerbatimArguments: true" in pi_extension
    assert 'const line = `"${windowsCommandLine(["nmem.cmd", ...baseArgs])}"`' in pi_extension
    assert "source_app=${source}" in pi_extension
    before_agent_start_block = pi_extension.split('pi.on("before_agent_start"', 1)[1].split('pi.on("agent_end"', 1)[0]
    assert "message:" not in before_agent_start_block

    omp_pkg = _read_json(OMP_PLUGIN / "package.json")
    omp_extension = (OMP_PLUGIN / "extensions" / "nowledge-mem.ts").read_text(encoding="utf-8")
    omp_agent = (OMP_PLUGIN / "AGENTS.md").read_text(encoding="utf-8")
    assert omp_pkg["version"] == "0.1.1"
    assert omp_pkg["dependencies"]["nowledge-mem-pi"] == "^0.8.4"
    assert "./extensions/nowledge-mem.ts" in omp_pkg["omp"]["extensions"]
    assert "./skills" in omp_pkg["omp"]["skills"]
    assert "pi" not in omp_pkg
    assert 'process.env.NMEM_PLUGIN_SOURCE_APP = "omp"' in omp_extension
    assert 'process.env.NMEM_PLUGIN_HOST_LABEL = "OMP"' in omp_extension
    assert 'process.env.NMEM_PLUGIN_VERSION = "0.1.1"' in omp_extension
    assert 'import("nowledge-mem-pi/extensions/nowledge-mem.ts")' in omp_extension
    assert "nmem --json context --source-app omp" in omp_agent
    assert "source_app=omp" in omp_agent

    assert "PI_CODING_AGENT_SESSION_DIR" in pi_history_sync
    assert "--apply" in pi_history_sync
    assert "historical_import: true" in pi_history_sync
    assert "deduplicate: true" in pi_history_sync
    assert "branchEntries" in pi_history_sync
    assert "warnFilesystem" in pi_history_sync
    assert "isFilesystemError" in pi_history_sync
    assert ".filter(Boolean)" in pi_history_sync
    assert "fileMtimes" in pi_history_sync
    assert "stablePathSuffix" in pi_history_sync
    assert "custom_message" in pi_history_sync

    kimi_root_manifest = _read_json(COMMUNITY_ROOT / "kimi.plugin.json")
    kimi_manifest = _read_json(KIMI_PLUGIN / "kimi.plugin.json")
    kimi_skill = (KIMI_PLUGIN / "skills" / "nowledge-mem" / "SKILL.md").read_text(encoding="utf-8")
    kimi_installer = (KIMI_PLUGIN / "scripts" / "install_hooks.py").read_text(encoding="utf-8")
    kimi_hook = (KIMI_PLUGIN / "scripts" / "kimi-sync-hook.py").read_text(encoding="utf-8")
    assert kimi_root_manifest["name"] == "nowledge-mem"
    assert kimi_root_manifest["version"] == kimi_manifest["version"]
    assert kimi_root_manifest["skills"] == "./nowledge-mem-kimi-code-plugin/skills/"
    assert kimi_root_manifest["commands"] == "./nowledge-mem-kimi-code-plugin/commands/"
    assert set(hook["event"] for hook in kimi_root_manifest["hooks"]) == {
        "Stop",
        "SessionEnd",
        "PreCompact",
        "SubagentStop",
        "Interrupt",
    }
    for hook in kimi_root_manifest["hooks"]:
        assert "nowledge-mem-kimi-code-plugin/scripts/kimi-sync-hook.py" in hook["command"]
    assert kimi_manifest["name"] == "nowledge-mem"
    assert kimi_manifest["version"] == "0.2.1"
    assert kimi_manifest["skills"] == "./skills/"
    assert kimi_manifest["sessionStart"]["skill"] == "nowledge-mem"
    assert kimi_manifest["mcpServers"]["nowledge-mem"]["url"] == "http://127.0.0.1:14242/mcp/"
    assert kimi_manifest["mcpServers"]["nowledge-mem"]["type"] == "streamableHttp"
    assert kimi_manifest["commands"] == "./commands/"
    kimi_hook_events = {hook["event"] for hook in kimi_manifest["hooks"]}
    assert kimi_hook_events == {"Stop", "SessionEnd", "PreCompact", "SubagentStop", "Interrupt"}
    for hook in kimi_manifest["hooks"]:
        assert hook["command"].startswith("python3 ./scripts/kimi-sync-hook.py")
        assert "python ./scripts/kimi-sync-hook.py" in hook["command"]
        assert "py -3 ./scripts/kimi-sync-hook.py" in hook["command"]
        assert hook["timeout"] == 40
    for command_name in ["status", "sync-now", "import-history"]:
        command_path = KIMI_PLUGIN / "commands" / f"{command_name}.md"
        assert command_path.exists()
        command_text = command_path.read_text(encoding="utf-8")
        assert "description:" in command_text
        assert "outdated" in command_text
        assert "CLI" in command_text
    assert "nmem --json context --source-app kimi-code" in kimi_skill
    assert "nmem --json t sync --from kimi-code --session-id <session-id> --apply" in kimi_skill
    assert "outdated CLI" in kimi_skill
    assert "source_app=kimi-code" in kimi_skill
    assert "Stop" in kimi_installer
    assert "SessionEnd" in kimi_installer
    assert "PreCompact" in kimi_installer
    assert "SubagentStop" in kimi_installer
    assert "Interrupt" in kimi_installer
    assert "BEGIN Nowledge Mem Kimi Code hooks" in kimi_installer
    assert "--from" in kimi_hook
    assert "kimi-code" in kimi_hook
    assert "--session-id" in kimi_hook
    assert "--apply" in kimi_hook
    assert "NMEM_KIMI_SYNC_TIMEOUT" in kimi_hook
    assert "CREATE_NO_WINDOW" in kimi_hook

    kimi_work_manifest = _read_json(KIMI_WORK_CONNECTOR / "kimi.plugin.json")
    kimi_work_skill = (
        KIMI_WORK_CONNECTOR / "skills" / "nowledge-mem" / "SKILL.md"
    ).read_text(encoding="utf-8")
    kimi_work_installer = (
        KIMI_WORK_CONNECTOR / "scripts" / "install_kimi_work_plugin.py"
    ).read_text(encoding="utf-8")
    assert kimi_work_manifest["name"] == "nowledge-mem"
    assert kimi_work_manifest["version"] == "0.1.0"
    assert kimi_work_manifest["skills"] == "./skills/"
    assert kimi_work_manifest["sessionStart"]["skill"] == "nowledge-mem"
    assert (
        kimi_work_manifest["mcpServers"]["nowledge-mem"]["url"]
        == "http://127.0.0.1:14242/mcp/"
    )
    assert "hooks" not in kimi_work_manifest
    assert "nmem --json context --source-app kimi-work" in kimi_work_skill
    assert "nmem t sync --from kimi-work --apply" in kimi_work_skill
    assert "source_app=kimi-work" in kimi_work_skill
    assert "KIMI_WORK_HOME" in kimi_work_installer
    assert "installed.json" in kimi_work_installer

    alma_manifest = _read_json(ALMA_PLUGIN / "manifest.json")
    alma_pkg = _read_json(ALMA_PLUGIN / "package.json")
    alma_skill = ALMA_PLUGIN / "skills" / "nowledge-mem" / "SKILL.md"
    alma_source = (ALMA_PLUGIN / "main.js").read_text(encoding="utf-8")
    assert alma_manifest["version"] == "0.7.4"
    assert alma_pkg["version"] == "0.7.4"
    assert alma_skill.exists()
    assert "nowledge_mem_context_bundle" in alma_skill.read_text(encoding="utf-8")
    assert "nowledge_mem_context_bundle" in alma_source
    assert "windowsHide: true" in alma_source


def test_codebuddy_hook_distinguishes_workbuddy_config_dirs(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    hook = _load_python_module(
        CODEBUDDY_PLUGIN / "scripts" / "codebuddy-sync-hook.py",
        "nowledge_mem_codebuddy_sync_hook",
    )
    workbuddy_home = tmp_path / "custom-workbuddy"
    codebuddy_home = tmp_path / "custom-codebuddy"
    workbuddy_session = workbuddy_home / "projects" / "p" / "session.jsonl"
    codebuddy_session = codebuddy_home / "projects" / "p" / "session.jsonl"
    workbuddy_session.parent.mkdir(parents=True)
    codebuddy_session.parent.mkdir(parents=True)
    workbuddy_session.write_text("{}", encoding="utf-8")
    codebuddy_session.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("WORKBUDDY_CONFIG_DIR", str(workbuddy_home))
    monkeypatch.setenv("CODEBUDDY_CONFIG_DIR", str(codebuddy_home))
    monkeypatch.delenv("NMEM_SOURCE_APP", raising=False)

    assert hook._source_app_for_payload({"transcript_path": str(workbuddy_session)}) == "workbuddy"
    assert hook._source_app_for_payload({"transcript_path": str(codebuddy_session)}) == "codebuddy"

    monkeypatch.setenv("NMEM_SOURCE_APP", "workbuddy")
    assert hook._source_app_for_payload({"transcript_path": str(codebuddy_session)}) == "workbuddy"


def test_kimi_code_hook_installer_uses_isolated_kimi_home(tmp_path: Path):
    kimi_home = tmp_path / ".kimi-code"
    config = kimi_home / "config.toml"
    config.parent.mkdir(parents=True)
    config.write_text(
        "\n".join(
            [
                '[model]',
                'default = "kimi-k2"',
                "",
                "[[hooks]]",
                'event = "Notification"',
                "matcher = 'task\\.completed'",
                'command = "echo done"',
                "timeout = 5",
                "",
            ]
        ),
        encoding="utf-8",
    )

    env = os.environ.copy()
    env["KIMI_CODE_HOME"] = str(kimi_home)
    installer = KIMI_PLUGIN / "scripts" / "install_hooks.py"
    _run([sys.executable, str(installer)], env=env, timeout=30)
    _run([sys.executable, str(installer)], env=env, timeout=30)

    hook_path = kimi_home / "hooks" / "nowledge-mem-sync-hook.py"
    assert hook_path.exists()
    assert os.access(hook_path, os.X_OK)

    text = config.read_text(encoding="utf-8")
    assert text.count("BEGIN Nowledge Mem Kimi Code hooks") == 1
    assert 'event = "Notification"' in text
    assert "nowledge-mem-sync-hook.py" in text
    assert "python3" in text or "py -3" in text
    assert str(sys.executable) not in text
    parsed = tomllib.loads(text)
    events = [hook["event"] for hook in parsed["hooks"]]
    assert events == ["Notification", "Stop", "SessionEnd", "PreCompact", "SubagentStop", "Interrupt"]
    assert any(path.name.startswith("config.toml.") and path.name.endswith(".bak") for path in kimi_home.iterdir())


def test_kimi_code_hook_installer_preserves_config_on_broken_managed_block(tmp_path: Path):
    kimi_home = tmp_path / ".kimi-code"
    config = kimi_home / "config.toml"
    config.parent.mkdir(parents=True)
    original = "\n".join(
        [
            '[model]',
            'default = "kimi-k2"',
            "",
            "# BEGIN Nowledge Mem Kimi Code hooks (managed by nowledge-mem-kimi-code-plugin)",
            "[[hooks]]",
            'event = "Stop"',
            'command = "python3 old-hook.py"',
            "",
            "[ui]",
            'theme = "dark"',
            "",
        ]
    )
    config.write_text(original, encoding="utf-8")

    env = os.environ.copy()
    env["KIMI_CODE_HOME"] = str(kimi_home)
    installer = KIMI_PLUGIN / "scripts" / "install_hooks.py"
    result = subprocess.run(
        [sys.executable, str(installer)],
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )

    assert result.returncode != 0
    assert "missing its END marker" in result.stderr
    assert config.read_text(encoding="utf-8") == original
    assert not any(path.name.endswith(".bak") for path in kimi_home.iterdir())


def test_kimi_code_sync_hook_invokes_nmem_for_session_id(tmp_path: Path):
    kimi_home = tmp_path / ".kimi-code"
    bin_dir = tmp_path / "bin"
    calls_file = tmp_path / "nmem-calls.jsonl"
    bin_dir.mkdir()
    fake_nmem = bin_dir / "nmem"
    fake_nmem.write_text(
        "\n".join(
            [
                "#!/usr/bin/env python3",
                "import json, os, sys",
                "with open(os.environ['NMEM_FAKE_CALLS'], 'a', encoding='utf-8') as handle:",
                "    handle.write(json.dumps(sys.argv[1:]) + '\\n')",
                "print('{\"status\":\"ok\"}')",
            ]
        ),
        encoding="utf-8",
    )
    fake_nmem.chmod(0o755)

    env = os.environ.copy()
    env["KIMI_CODE_HOME"] = str(kimi_home)
    env["NMEM_FAKE_CALLS"] = str(calls_file)
    env["PATH"] = f"{bin_dir}{os.pathsep}{env.get('PATH', '')}"
    hook = KIMI_PLUGIN / "scripts" / "kimi-sync-hook.py"
    payload = json.dumps({"hook_event_name": "Stop", "session_id": "kimi-session-123"})

    result = subprocess.run(
        [sys.executable, str(hook)],
        input=payload,
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0
    calls = [json.loads(line) for line in calls_file.read_text(encoding="utf-8").splitlines()]
    assert calls == [
        [
            "--json",
            "t",
            "sync",
            "--from",
            "kimi-code",
            "--session-id",
            "kimi-session-123",
            "--apply",
        ]
    ]
    log_text = (kimi_home / "logs" / "nowledge-mem-hook.log").read_text(encoding="utf-8")
    assert "synced Stop kimi-session-123" in log_text


def test_kimi_work_installer_writes_managed_plugin_record(tmp_path: Path):
    kimi_home = tmp_path / "kimi-work-home"
    existing_root = kimi_home / "plugins" / "managed" / "nowledge-mem"
    existing_root.mkdir(parents=True)
    installed = kimi_home / "plugins" / "installed.json"
    installed.write_text(
        json.dumps(
            {
                "version": 1,
                "plugins": [
                    {
                        "id": "nowledge-mem",
                        "root": str(existing_root),
                        "source": "local-path",
                        "enabled": False,
                        "installedAt": "2026-01-01T00:00:00+00:00",
                        "capabilities": {
                            "mcpServers": {"nowledge-mem": {"enabled": False}}
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    result = _run(
        [
            sys.executable,
            str(KIMI_WORK_CONNECTOR / "scripts" / "install_kimi_work_plugin.py"),
        ],
        env={**os.environ, "KIMI_WORK_HOME": str(kimi_home)},
    )

    assert "Restart Kimi Work" in result.stdout
    assert (existing_root / "kimi.plugin.json").exists()
    assert (existing_root / "skills" / "nowledge-mem" / "SKILL.md").exists()
    data = _read_json(installed)
    record = next(item for item in data["plugins"] if item["id"] == "nowledge-mem")
    assert record["root"] == str(existing_root)
    assert record["enabled"] is False
    assert record["installedAt"] == "2026-01-01T00:00:00+00:00"
    assert record["capabilities"]["mcpServers"]["nowledge-mem"]["enabled"] is False
    assert record["originalSource"] == str(KIMI_WORK_CONNECTOR)


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
                        "type": "custom_message",
                        "id": "ctx",
                        "parentId": "u1",
                        "timestamp": "2026-06-10T00:00:03Z",
                        "customType": "visible-extension",
                        "content": "visible extension context",
                        "display": True,
                    }
                ),
                json.dumps(
                    {
                        "type": "message",
                        "id": "hidden-context",
                        "parentId": "ctx",
                        "timestamp": "2026-06-10T00:00:03Z",
                        "message": {"role": "custom", "content": "Context Bundle should not sync"},
                    }
                ),
                json.dumps(
                    {
                        "type": "message",
                        "id": "a1",
                        "parentId": "hidden-context",
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
    assert preview_json["sessions"][0]["messageCount"] == 3
    preview_text = json.dumps(preview_json)
    assert "Context Bundle should not sync" not in preview_text
    assert "abandoned branch should not import" not in preview_text
    assert "visible extension context" in preview_text

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
        server.server_close()

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
        "Pi custom context (visible-extension):\nvisible extension context",
        "history assistant message",
    ]
    assert all(message["metadata"]["source_app"] == "pi" for message in create_body["messages"])
    assert append_body["deduplicate"] is True
    assert append_body["space_id"] == "pi-history-space"
    assert append_body["historical_import"] is True
    assert append_body["analysis"] == "searchable-now-distill-on-demand"
    assert append_body["idempotency_key"] == "pi:history:History Session/One:3"


def test_pi_history_sync_script_avoids_ambiguous_session_identity(tmp_path: Path):
    if shutil.which("node") is None:
        pytest.skip("Pi history sync script smoke requires node on PATH")

    script = PI_PLUGIN / "scripts" / "sync-history.mjs"

    def write_session(path: Path, *, include_ids: bool = True) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        user_entry = {
            "type": "message",
            "timestamp": "2026-06-10T00:00:01Z",
            "message": {"role": "user", "content": f"user from {path.parent.name}"},
        }
        assistant_entry = {
            "type": "message",
            "timestamp": "2026-06-10T00:00:02Z",
            "message": {"role": "assistant", "content": f"assistant from {path.parent.name}"},
        }
        if include_ids:
            user_entry.update({"id": "u1", "parentId": None})
            assistant_entry.update({"id": "a1", "parentId": "u1"})
        path.write_text(
            "\n".join(
                [
                    json.dumps({"type": "session", "version": 3, "timestamp": "2026-06-10T00:00:00Z"}),
                    json.dumps(user_entry),
                    json.dumps(assistant_entry),
                ]
            )
            + "\n",
            encoding="utf-8",
        )

    write_session(tmp_path / "one" / "session.jsonl")
    write_session(tmp_path / "two" / "session.jsonl")
    write_session(tmp_path / "broken" / "session.jsonl", include_ids=False)

    preview = _run(["node", str(script), "--session-dir", str(tmp_path), "--json"], timeout=30)
    preview_json = json.loads(preview.stdout)
    thread_ids = [session["threadId"] for session in preview_json["sessions"]]

    assert preview_json["summary"]["found"] == 3
    assert preview_json["summary"]["importable"] == 2
    assert len({thread_id for thread_id in thread_ids if thread_id.startswith("pi-session-")}) == 3
    assert len(set(thread_ids)) == 3
    skipped = [session for session in preview_json["sessions"] if not session["importable"]]
    assert len(skipped) == 1
    assert skipped[0]["messageCount"] == 0


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
    assert by_id["copilot-cli"]["version"] == "0.1.4"
    assert by_id["gemini-cli"]["version"] == "0.1.9"
    assert by_id["cursor"]["version"] == "0.1.6"
    assert by_id["droid"]["version"] == "0.1.1"
    assert by_id["openclaw"]["version"] == "0.8.31"
    assert by_id["proma"]["version"] == "0.1.4"
    assert by_id["opencode"]["version"] == "0.3.5"
    assert by_id["pi"]["version"] == "0.8.5"
    assert by_id["pi"]["capabilities"]["autoRecall"] is True
    assert by_id["pi"]["autonomy"]["recall"] == "startup-context-injection"
    assert by_id["kimi-code"]["version"] == "0.2.1"
    assert by_id["kimi-code"]["directory"] == "nowledge-mem-kimi-code-plugin"
    assert by_id["kimi-code"]["transport"] == "mcp+skills+hook"
    assert by_id["kimi-code"]["capabilities"]["autoCapture"] is True
    assert by_id["kimi-code"]["threadSave"]["method"] == "hook+cli-native"
    assert by_id["kimi-code"]["autonomy"]["threads"] == "automatic-capture"
    assert by_id["kimi-code"]["skills"] == ["nowledge-mem"]
    assert by_id["kimi-code"]["slashCommands"] == [
        "nowledge-mem:status",
        "nowledge-mem:sync-now",
        "nowledge-mem:import-history",
    ]
    assert by_id["kimi-work"]["version"] == "0.1.0"
    assert by_id["kimi-work"]["directory"] == "nowledge-mem-kimi-work-connector"
    assert by_id["kimi-work"]["transport"] == "mcp+skills"
    assert by_id["kimi-work"]["capabilities"]["autoCapture"] is False
    assert by_id["kimi-work"]["threadSave"]["method"] == "cli-native"
    assert by_id["kimi-work"]["threadSave"]["historicalCommand"] == (
        "nmem t sync --from kimi-work"
    )
    assert by_id["kimi-work"]["autonomy"]["threads"] == "import-only"
    assert by_id["kimi-work"]["skills"] == ["nowledge-mem"]
    assert by_id["antigravity-extractor"]["threadSave"]["method"] == "cli-native"
    assert by_id["antigravity-extractor"]["autonomy"]["threads"] == "import-only"
    assert "nmem t sync --from antigravity" in by_id["antigravity-extractor"][
        "autonomy"
    ]["bestResultRequires"][0]
    for connector_id in ["zcode", "mimo-code"]:
        connector = by_id[connector_id]
        assert connector["version"] is None
        assert connector["transport"] == "mcp+skills"
        assert connector["capabilities"]["autoCapture"] is False
        assert connector["install"]["command"] == f"nmem config mcp show --host {connector_id}"
        assert "save-handoff" in connector["skills"]
        assert "save-thread" not in connector["skills"]
    for connector_id in ["mimo-code"]:
        connector = by_id[connector_id]
        assert connector["threadSave"]["method"] == "cli-native"
        assert connector["autonomy"]["threads"] == "import-only"
        assert connector["threadSave"]["historicalCommand"] == (
            f"nmem t sync --from {connector_id}"
        )
    assert by_id["zcode"]["threadSave"]["method"] == "none"
    assert by_id["zcode"]["autonomy"]["threads"] == "handoff-only"
    assert by_id["alma"]["version"] == "0.7.4"
    assert by_id["alma"]["skills"] == ["nowledge-mem"]
    assert "nowledge_mem_context_bundle" in by_id["alma"]["toolNaming"]["tools"]
    assert by_id["bub"]["version"] == "0.7.3"
    assert by_id["pi"]["threadSave"]["method"] == "plugin-capture"
    assert by_id["pi"]["capabilities"]["autoCapture"] is True
    assert by_id["pi"]["autonomy"]["threads"] == "automatic-capture"
    assert by_id["omp"]["version"] == "0.1.1"
    assert by_id["omp"]["directory"] == "nowledge-mem-omp-plugin"
    assert by_id["omp"]["transport"] == "plugin+cli"
    assert by_id["omp"]["capabilities"]["autoRecall"] is True
    assert by_id["omp"]["capabilities"]["autoCapture"] is True
    assert by_id["omp"]["threadSave"]["method"] == "plugin-capture"
    assert by_id["omp"]["threadSave"]["historicalCommand"] == "nmem t sync --from omp"
    assert by_id["omp"]["autonomy"]["recall"] == "startup-context-injection"
    assert by_id["omp"]["autonomy"]["threads"] == "automatic-capture"
    assert by_id["omp"]["install"]["command"] == "omp plugin install nowledge-mem-omp"
    assert "save-thread" in by_id["omp"]["skills"]
    assert "nowledge_mem_context_bundle" in by_id["opencode"]["toolNaming"]["tools"]


def test_host_owned_official_integrations_keep_their_real_boundaries():
    registry = _read_json(COMMUNITY_ROOT / "integrations.json")
    by_id = {entry["id"]: entry for entry in registry["integrations"]}
    does_not_apply = set(registry["connect"]["doesNotApplyTo"])

    for integration_id in ("cradle", "arkloop", "opticlm"):
        entry = by_id[integration_id]
        assert entry["directory"] is None
        assert entry["externalRepo"].startswith("https://github.com/")
        assert entry["install"]["docsUrl"] == f"/docs/integrations/{integration_id}"
        assert "agentGuide" not in entry["install"]
        assert integration_id in does_not_apply

    assert by_id["cradle"]["autonomy"]["threads"] == "explicit-save"
    assert by_id["cradle"]["capabilities"]["autoCapture"] is False
    assert by_id["arkloop"]["autonomy"]["recall"] == "automatic"
    assert by_id["arkloop"]["autonomy"]["threads"] == "automatic-capture"
    assert by_id["opticlm"]["capabilities"]["workingMemory"] is False
    assert by_id["opticlm"]["capabilities"]["autoRecall"] is False


def test_save_surfaces_do_not_default_omitted_unit_type_to_fact():
    bub_pyproject = (BUB_PLUGIN / "pyproject.toml").read_text(encoding="utf-8")
    bub_client = (
        BUB_PLUGIN / "src" / "nowledge_mem_bub" / "client.py"
    ).read_text(encoding="utf-8")
    bub_tools = (
        BUB_PLUGIN / "src" / "nowledge_mem_bub" / "tools.py"
    ).read_text(encoding="utf-8")
    assert 'version = "0.7.3"' in bub_pyproject
    assert "CREATE_NO_WINDOW" in bub_client
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


def test_pi_sync_does_not_amplify_transport_failures_and_keeps_latest_payload():
    if shutil.which("bun") is None:
        pytest.skip("Pi extension concurrency smoke requires bun on PATH")

    script = dedent(
        """
        import http from "node:http";

        delete process.env.NMEM_PLUGIN_DEBUG;
        const warnings = [];
        console.warn = (...args) => warnings.push(args.map(String).join(" "));

        const { default: nowledgeMemPi } = await import(process.env.PI_EXTENSION_URL);
        const calls = [];
        let latestAppendCompleted = false;
        let resolveCreateSeen;
        const createSeen = new Promise((resolve) => { resolveCreateSeen = resolve; });
        const server = http.createServer((req, res) => {
          let raw = "";
          req.on("data", (chunk) => raw += chunk);
          req.on("end", () => {
            const body = raw ? JSON.parse(raw) : {};
            calls.push({ url: req.url, body });
            if (body.thread_id === "pi-transport-failure") {
              req.socket.destroy();
              return;
            }
            res.setHeader("content-type", "application/json");
            if (body.thread_id === "pi-existing-thread") {
              res.statusCode = 409;
              res.end(JSON.stringify({ detail: "thread already exists" }));
              return;
            }
            if (req.url === "/threads") {
              resolveCreateSeen();
              setTimeout(() => res.end(JSON.stringify({ ok: true })), 100);
              return;
            }
            if (req.url?.includes("pi-latest-payload")) {
              setTimeout(() => {
                latestAppendCompleted = true;
                res.end(JSON.stringify({ ok: true }));
              }, 100);
              return;
            }
            res.end(JSON.stringify({ ok: true }));
          });
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        const { port } = server.address();
        process.env.NMEM_API_URL = `http://127.0.0.1:${port}`;

        const handlers = new Map();
        nowledgeMemPi({ on(event, handler) { handlers.set(event, handler); } });
        const entriesFor = (prefix) => [
          {
            id: `${prefix}-u1`,
            type: "message",
            timestamp: "2026-07-22T10:00:00Z",
            message: { role: "user", content: `${prefix} user one` },
          },
          {
            id: `${prefix}-a1`,
            type: "message",
            timestamp: "2026-07-22T10:00:01Z",
            message: { role: "assistant", content: `${prefix} assistant one` },
          },
        ];
        const contextFor = (id, entries) => ({
          hasUI: true,
          sessionManager: {
            getBranch: () => entries,
            getSessionId: () => id,
            getSessionName: () => id,
            getCwd: () => "/tmp/pi-sync-contract",
            getSessionFile: () => `/tmp/pi-sync-contract/${id}.jsonl`,
          },
        });

        const failedEntries = entriesFor("failed");
        await handlers.get("session_before_compact")?.(
          { type: "session_before_compact" },
          contextFor("transport-failure", failedEntries),
        );

        const existingEntries = entriesFor("existing");
        await handlers.get("session_before_compact")?.(
          { type: "session_before_compact" },
          contextFor("existing-thread", existingEntries),
        );

        const latestEntries = entriesFor("latest");
        const latestContext = contextFor("latest-payload", latestEntries);
        const first = handlers.get("session_before_compact")?.(
          { type: "session_before_compact" },
          latestContext,
        );
        await createSeen;
        latestEntries.push(
          {
            id: "latest-u2",
            type: "message",
            timestamp: "2026-07-22T10:00:02Z",
            message: { role: "user", content: "latest user two" },
          },
          {
            id: "latest-a2",
            type: "message",
            timestamp: "2026-07-22T10:00:03Z",
            message: { role: "assistant", content: "latest assistant two" },
          },
        );
        let secondResolvedAfterAppend = false;
        const second = handlers.get("session_before_compact")?.(
          { type: "session_before_compact" },
          latestContext,
        ).then(() => {
          secondResolvedAfterAppend = latestAppendCompleted;
        });
        await Promise.all([first, second]);

        const boundaryEntries = entriesFor("boundary");
        const boundaryContext = contextFor("boundary", boundaryEntries);
        await handlers.get("agent_end")?.({ type: "agent_end" }, boundaryContext);
        await handlers.get("session_shutdown")?.(
          { type: "session_shutdown", reason: "quit" },
          boundaryContext,
        );
        await new Promise((resolve) => setTimeout(resolve, 850));
        await new Promise((resolve) => server.close(resolve));

        const failedCalls = calls.filter((call) =>
          call.body.thread_id === "pi-transport-failure" ||
          call.url?.includes("pi-transport-failure")
        );
        if (failedCalls.length !== 1 || failedCalls[0].url !== "/threads") {
          throw new Error(`transport failure was amplified: ${JSON.stringify(failedCalls)}`);
        }
        const existingCalls = calls.filter((call) =>
          call.body.thread_id === "pi-existing-thread" ||
          call.url?.includes("pi-existing-thread")
        );
        if (existingCalls.length !== 2 || existingCalls[1].body.messages.length !== 2) {
          throw new Error(`existing thread did not append: ${JSON.stringify(existingCalls)}`);
        }
        const latestCalls = calls.filter((call) =>
          call.body.thread_id === "pi-latest-payload" ||
          call.url?.includes("pi-latest-payload")
        );
        if (latestCalls.length !== 2) {
          throw new Error(`expected create plus latest append: ${JSON.stringify(latestCalls)}`);
        }
        if (latestCalls[0].body.messages.length !== 2) {
          throw new Error(`initial payload changed: ${JSON.stringify(latestCalls[0])}`);
        }
        if (latestCalls[1].body.messages.length !== 4) {
          throw new Error(`latest payload was dropped: ${JSON.stringify(latestCalls[1])}`);
        }
        if (!secondResolvedAfterAppend) {
          throw new Error("concurrent lifecycle flush returned before the latest payload completed");
        }
        const boundaryCalls = calls.filter((call) =>
          call.body.thread_id === "pi-boundary" || call.url?.includes("pi-boundary")
        );
        if (boundaryCalls.length !== 1) {
          throw new Error(`session boundary duplicated sync: ${JSON.stringify(boundaryCalls)}`);
        }
        if (warnings.length !== 0) {
          throw new Error(`interactive diagnostics leaked to stderr: ${JSON.stringify(warnings)}`);
        }
        console.log(JSON.stringify({ ok: true, calls: calls.length }));
        """
    )
    env = os.environ.copy()
    env["PI_EXTENSION_URL"] = (PI_PLUGIN / "extensions" / "nowledge-mem.ts").resolve().as_uri()
    result = _run(["bun", "--eval", script], env=env, timeout=30)
    assert '"ok":true' in result.stdout.replace(" ", "")


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

    # Fake `nmem` CLI so the runtime smoke exercises startup Context Bundle
    # injection without depending on the real Nowledge Mem server. The fake
    # records every argv it receives to a JSONL file and returns a Context
    # Bundle payload for `context --source-app pi`.
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    record_path = tmp_path / "nmem-calls.jsonl"
    python = sys.executable
    fake_script = bin_dir / "nmem_fake.py"
    fake_script.write_text(
        dedent(
            '''
            import json
            import os
            import sys

            args = sys.argv[1:]
            record_path = os.environ.get("NMEM_FAKE_RECORD")
            if record_path:
                with open(record_path, "a", encoding="utf-8") as handle:
                    handle.write(json.dumps(args) + "\\n")
            if "context" in args:
                payload = {
                    "rendered_markdown": "# Pi smoke Context Bundle\\n\\nInjected by fake nmem.",
                    "content": "# Pi smoke Context Bundle fallback",
                }
            elif "wm" in args:
                payload = {"exists": True, "content": "# Working Memory fallback"}
            else:
                payload = {}
            sys.stdout.write(json.dumps(payload))
            '''
        ),
        encoding="utf-8",
    )
    (bin_dir / "nmem").write_text(
        f'#!/bin/sh\nexec "{python}" "$(dirname "$0")/nmem_fake.py" "$@"\n',
        encoding="utf-8",
    )
    (bin_dir / "nmem.cmd").write_text(
        f'@echo off\r\n"{python}" "%~dp0nmem_fake.py" %*\r\n',
        encoding="utf-8",
    )
    (bin_dir / "nmem").chmod(0o755)

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

        // Startup context injection: session_start loads the Context Bundle via
        // the fake nmem, then before_agent_start appends it to the system prompt.
        await handlers.get("session_start")?.({ type: "session_start" }, ctx);
        const injection = await handlers.get("before_agent_start")?.(
          { systemPrompt: "Original pi smoke system prompt." },
          ctx,
        );
        if (!injection || typeof injection !== "object") {
          throw new Error("before_agent_start returned no value");
        }
        if (typeof injection.systemPrompt !== "string") {
          throw new Error("before_agent_start missing systemPrompt");
        }
        if (!injection.systemPrompt.includes("Original pi smoke system prompt.")) {
          throw new Error("original system prompt not preserved");
        }
        if (!injection.systemPrompt.includes("Pi smoke Context Bundle")) {
          throw new Error("Context Bundle not injected into systemPrompt");
        }
        if (!injection.systemPrompt.includes("## Nowledge Mem")) {
          throw new Error("behavioral guidance not injected");
        }
        if ("message" in injection) {
          throw new Error("before_agent_start returned a message property");
        }
        const noKeyInjection = await handlers.get("before_agent_start")?.(
          { systemPrompt: "No key pi smoke system prompt." },
          { sessionManager: {} },
        );
        if (!noKeyInjection?.systemPrompt?.includes("Pi smoke Context Bundle")) {
          throw new Error("Context Bundle not injected when session key is unavailable");
        }

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
    smoke_env["PATH"] = str(bin_dir) + os.pathsep + smoke_env.get("PATH", "")
    smoke_env["NMEM_FAKE_RECORD"] = str(record_path)
    result = _run(["bun", "--eval", script], env=smoke_env, timeout=30)
    assert '"ok":true' in result.stdout.replace(" ", "")

    # The fake nmem recorded every argv it received. Confirm the startup
    # context read used the Context Bundle command with the ambient flags.
    recorded = []
    if record_path.exists():
        for line in record_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                recorded.append(json.loads(line))
    context_calls = [c for c in recorded if "context" in c and "--source-app" in c]
    assert context_calls, f"no context call recorded: {recorded}"
    context_call = context_calls[0]
    assert "pi" in context_call, f"context call missing --source-app pi: {context_call}"
    assert "--space" in context_call, f"context call missing --space: {context_call}"
    assert "pi-smoke-space" in context_call, f"context call missing space value: {context_call}"
    assert "--agent-id" in context_call, f"context call missing --agent-id: {context_call}"
    assert "PiSmokeAgent" in context_call, f"context call missing agent id value: {context_call}"
    assert "--host-agent-id" in context_call, f"context call missing --host-agent-id: {context_call}"
    assert "slock:PiSmokeAgent" in context_call, f"context call missing host agent id value: {context_call}"


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
    legacy_plugin_hooks = _codex_requires_legacy_plugin_hooks(codex_env)
    if not legacy_plugin_hooks and (codex_home / "config.toml").exists():
        # Exercise a clean modern install. The installer deliberately preserves
        # an old removed key when a user's existing config still contains it.
        config_lines = (codex_home / "config.toml").read_text(encoding="utf-8").splitlines()
        config_lines = [
            line for line in config_lines if not line.strip().startswith("plugin_hooks =")
        ]
        (codex_home / "config.toml").write_text(
            "\n".join(config_lines) + "\n",
            encoding="utf-8",
        )

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
                            "installation": "AVAILABLE",
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
        ["codex", "plugin", "marketplace", "add", str(workspace), "--json"],
        env=codex_env,
        timeout=30,
    )
    install_result = _run(
        ["codex", "plugin", "add", "nowledge-mem@local", "--json"],
        env=codex_env,
        timeout=30,
    )
    installed_plugin = Path(json.loads(install_result.stdout)["installedPath"])
    expected_version = _read_json(CODEX_PLUGIN / ".codex-plugin" / "plugin.json")["version"]
    assert installed_plugin.name == expected_version
    _run(
        ["python3", str(installed_plugin / "scripts" / "install_hooks.py")],
        env=codex_env,
        timeout=30,
    )
    codex_config = (codex_home / "config.toml").read_text(encoding="utf-8")
    assert "hooks = true" in codex_config
    if legacy_plugin_hooks:
        assert "plugin_hooks = true" in codex_config
    else:
        assert "plugin_hooks = true" not in codex_config
    assert "nowledge-mem@nowledge-community:hooks/hooks.json:stop:0:0" in codex_config
    assert "nowledge-mem@local:hooks/hooks.json:stop:0:0" in codex_config

    prompt = (
        f"This is a Nowledge Mem integration test marker {e2e_context.marker}. "
        "Do not call any Nowledge Mem save-thread skill or nmem command. "
        f"Just reply exactly: done {e2e_context.marker}"
    )
    command = [
        "codex",
        "--dangerously-bypass-hook-trust",
        "exec",
        "-C",
        str(workspace),
        "--skip-git-repo-check",
        "--json",
        "--enable",
        "plugins",
        "--enable",
        "hooks",
        "-c",
        'plugins."nowledge-mem@local".enabled=true',
    ]
    if legacy_plugin_hooks:
        config_index = command.index("-c")
        command[config_index:config_index] = ["--enable", "plugin_hooks"]
    if os.environ.get("NMEM_E2E_CODEX_MODEL"):
        command.extend(["--model", os.environ["NMEM_E2E_CODEX_MODEL"]])
    command.append(prompt)

    result = _run(command, env=codex_env, timeout=240)
    assert e2e_context.marker in result.stdout
    transcript = _latest_codex_transcript(codex_home)
    transcript_text = transcript.read_text(encoding="utf-8", errors="replace")
    assert "Nowledge Mem routing" in transcript_text
    assert "Codex local Memory is only a local hint" in transcript_text
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
    isolated_config_data = _read_json(isolated_config)
    plugins_config = isolated_config_data.get("plugins")
    if isinstance(plugins_config, dict):
        entries = plugins_config.get("entries")
        if isinstance(entries, dict):
            entries.pop("openclaw-nowledge-mem", None)
        allow = plugins_config.get("allow")
        if isinstance(allow, list):
            plugins_config["allow"] = [
                plugin_id for plugin_id in allow if plugin_id != "openclaw-nowledge-mem"
            ]
        slots = plugins_config.get("slots")
        if isinstance(slots, dict):
            for slot_name in ("memory", "contextEngine"):
                if slots.get(slot_name) in ("openclaw-nowledge-mem", "nowledge-mem"):
                    slots.pop(slot_name)
    isolated_config.write_text(
        json.dumps(isolated_config_data, indent=2) + "\n", encoding="utf-8"
    )
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
        {
            "path": "plugins.entries.openclaw-nowledge-mem.hooks.allowConversationAccess",
            "value": True,
        },
        {"path": "plugins.entries.openclaw-nowledge-mem.config.sessionDigest", "value": True},
        {"path": "plugins.entries.openclaw-nowledge-mem.config.sessionContext", "value": True},
        {"path": "plugins.entries.openclaw-nowledge-mem.config.space", "value": e2e_context.space},
        {"path": "plugins.slots.contextEngine", "value": "nowledge-mem"},
    ]
    tools_config = isolated_config_data.get("tools", {})
    tools_allow = tools_config.get("allow")
    tools_also_allow = tools_config.get("alsoAllow")
    if isinstance(tools_allow, list):
        config_ops.append(
            {
                "path": "tools.allow",
                "value": [*tools_allow, "openclaw-nowledge-mem"]
                if "openclaw-nowledge-mem" not in tools_allow
                else tools_allow,
            }
        )
    elif tools_config.get("profile") not in (None, "full"):
        existing_also_allow = tools_also_allow if isinstance(tools_also_allow, list) else []
        config_ops.append(
            {
                "path": "tools.alsoAllow",
                "value": [*existing_also_allow, "openclaw-nowledge-mem"]
                if "openclaw-nowledge-mem" not in existing_also_allow
                else existing_also_allow,
            }
        )
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
    thread = _poll_thread(
        marker=e2e_context.marker,
        source="openclaw",
        space=e2e_context.space,
        env=e2e_context.env,
    )
    assert thread["title"] == prompt


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
    model = os.environ.get("NMEM_E2E_OPENCODE_MODEL", "opencode/mimo-v2.5-free")
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
