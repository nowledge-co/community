from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest


COMMUNITY_ROOT = Path(__file__).resolve().parents[2]
CLAUDE_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-claude-code-plugin"
CODEX_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-codex-plugin"
OPENCLAW_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-openclaw-plugin"
HERMES_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-hermes"
OPENCODE_PLUGIN = COMMUNITY_ROOT / "nowledge-mem-opencode-plugin"
KEY_HOSTS = {"claude", "codex", "openclaw", "hermes", "opencode"}


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
        search = _nmem_json(["t", "search", marker, "--space", space, "-n", "50"], env=env)
        for thread in search.get("threads", []):
            thread_id = thread.get("id")
            if thread_id:
                _run(["nmem", "t", "delete", thread_id, "--space", space, "-f"], env=env, timeout=30)
        memories = _nmem_json(["m", "search", marker, "--space", space, "-n", "50"], env=env)
        memory_ids = [memory.get("id") for memory in memories.get("memories", []) if memory.get("id")]
        if memory_ids:
            _run(["nmem", "m", "delete", *memory_ids, "--space", space, "-f"], env=env, timeout=30)
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


def test_key_plugin_static_contracts_are_declared():
    claude_manifest = _read_json(CLAUDE_PLUGIN / ".claude-plugin" / "plugin.json")
    claude_hooks = _read_json(CLAUDE_PLUGIN / "hooks" / "hooks.json")["hooks"]
    assert claude_manifest["name"] == "nowledge-mem"
    assert {"SessionStart", "UserPromptSubmit", "PreCompact", "Stop"} <= set(claude_hooks)
    assert "nmem-hook-save.py" in json.dumps(claude_hooks)
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
    assert (CODEX_PLUGIN / "scripts" / "install_hooks.py").exists()
    assert (CODEX_PLUGIN / "skills" / "working-memory" / "SKILL.md").exists()
    assert (CODEX_PLUGIN / "skills" / "save-thread" / "SKILL.md").exists()

    openclaw_manifest = _read_json(OPENCLAW_PLUGIN / "openclaw.plugin.json")
    schema = openclaw_manifest["configSchema"]["properties"]
    assert openclaw_manifest["kind"] == ["memory", "context-engine"]
    assert "skills/memory-guide" in openclaw_manifest["skills"]
    assert schema["sessionDigest"]["default"] is True
    assert schema["sessionContext"]["default"] is False
    assert "dreaming" in schema
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
    assert opencode_pkg["version"] == "0.3.3"
    assert "fetchSessionMessages" in opencode_source
    assert "path: { id: ctx.sessionID }" in opencode_source
    assert "nowledge_mem_save_thread" in opencode_source


def test_key_plugin_credentials_stay_out_of_static_runtime_urls():
    hermes_client = (HERMES_PLUGIN / "client.py").read_text(encoding="utf-8").lower()
    openclaw_client = (OPENCLAW_PLUGIN / "src" / "client.js").read_text(encoding="utf-8").lower()
    assert "nmem_api_key=" not in hermes_client
    assert "nmem_api_key=" not in openclaw_client
    assert "Authorization" not in (CODEX_PLUGIN / ".mcp.json").read_text(encoding="utf-8")


@pytest.mark.skipif(_skip_live_host("claude"), reason="Claude live E2E not requested")
def test_claude_code_live_thread_capture(e2e_context: E2EContext, tmp_path: Path):
    _require_live_host("claude")
    prompt = f"Reply with exactly: done {e2e_context.marker}"
    command = [
        "claude",
        "-p",
        prompt,
        "--plugin-dir",
        str(CLAUDE_PLUGIN),
        "--session-id",
        str(uuid.uuid4()),
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
        cwd=str(tmp_path),
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
        "-c",
        'plugins."nowledge-mem@local".enabled=true',
    ]
    if os.environ.get("NMEM_E2E_CODEX_MODEL"):
        command.extend(["--model", os.environ["NMEM_E2E_CODEX_MODEL"]])
    command.append(prompt)

    result = _run(command, env=codex_env, timeout=240)
    assert e2e_context.marker in result.stdout
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
    # OpenClaw profiles isolate config, not the installed extension directory.
    # Install a package-shaped copy with --force so the safety scanner sees what
    # users receive from npm/ClawHub instead of checkout-only test fixtures.
    _run([*base, "plugins", "install", str(plugin_copy), "--force"], env=e2e_context.env, timeout=120)

    default_config = Path.home() / ".openclaw" / "openclaw.json"
    default_config_backup = default_config.read_bytes() if not profile and default_config.exists() else None
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
    try:
        _run([*base, "config", "set", "--batch-file", str(batch_file)], env=e2e_context.env, timeout=60)

        prompt = f"Reply with exactly: done {e2e_context.marker}"
        result = _run(
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
            env=e2e_context.env,
            timeout=int(os.environ.get("NMEM_E2E_OPENCLAW_TIMEOUT_SECONDS", "180")) + 30,
        )
        assert e2e_context.marker in (result.stdout + result.stderr)
        _poll_thread(
            marker=e2e_context.marker,
            source="openclaw",
            space=e2e_context.space,
            env=e2e_context.env,
        )
    finally:
        if default_config_backup is not None:
            default_config.write_bytes(default_config_backup)


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
