"""Contract tests for the Dim Nowledge Mem plugin.

Static tests need neither Dim nor a Mem server:
    uv run --with pytest pytest tests/plugin_e2e -q -k dim

Live smoke test (requires a Dim build, a model endpoint, and nmem):
    NMEM_PLUGIN_E2E=1 NMEM_PLUGIN_E2E_HOSTS=dim \
    NMEM_DIM_E2E_BIN=/path/to/dimcode \
    NMEM_DIM_E2E_BASE_URL=... NMEM_DIM_E2E_MODEL=... \
    uv run --with pytest pytest tests/plugin_e2e -q -k dim

The live test uses a disposable Dim Home (`--home`) and a disposable `HOME`
directory, creates a temporary Space, and deletes the Space (with any Thread
captured into it) at teardown. When Mem is not the default local server, pass
`NMEM_E2E_API_URL` and `NMEM_E2E_API_KEY`; when its MCP endpoint is not the
default, pass `NMEM_MCP_URL`. The model endpoint is given by
`NMEM_DIM_E2E_BASE_URL`, `NMEM_DIM_E2E_MODEL`, an optional
`NMEM_DIM_E2E_API_KEY`, and an optional `NMEM_DIM_E2E_API_FORMAT` (default
`openai-chat`).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any

import pytest

COMMUNITY_ROOT = Path(__file__).resolve().parents[2]
PLUGIN_DIR = COMMUNITY_ROOT / "nowledge-mem-dim-plugin"
HOOK_EVENTS = ("SessionStart", "UserPromptSubmit", "Stop")


def _bool_env(name: str) -> bool:
    value = os.environ.get(name)
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _requested_hosts() -> set[str]:
    raw = os.environ.get("NMEM_PLUGIN_E2E_HOSTS", "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _require_live_dim() -> str:
    if not _bool_env("NMEM_PLUGIN_E2E"):
        pytest.skip("set NMEM_PLUGIN_E2E=1 to run live host integration tests")
    if "dim" not in _requested_hosts():
        pytest.skip("dim not requested by NMEM_PLUGIN_E2E_HOSTS")
    value = os.environ.get("NMEM_DIM_E2E_BIN", "").strip()
    if not value:
        pytest.skip("set NMEM_DIM_E2E_BIN to a Dim build to run live Dim integration tests")
    binary = Path(value).expanduser()
    assert binary.is_file(), f"NMEM_DIM_E2E_BIN is not a file: {binary}"
    assert os.access(binary, os.X_OK), f"NMEM_DIM_E2E_BIN is not executable: {binary}"
    assert shutil.which("nmem") is not None, "live Dim E2E requires nmem on PATH"
    return str(binary)


def _model_env() -> dict[str, str]:
    env = {
        "DIM_BASE_URL": os.environ.get("NMEM_DIM_E2E_BASE_URL", "").strip(),
        "DIM_MODEL": os.environ.get("NMEM_DIM_E2E_MODEL", "").strip(),
        "DIM_API_FORMAT": os.environ.get("NMEM_DIM_E2E_API_FORMAT", "").strip()
        or "openai-chat",
        "DIM_MAX_CONTEXT_TOKENS": os.environ.get("NMEM_DIM_E2E_MAX_CONTEXT_TOKENS", "").strip()
        or "128000",
        "DIM_MAX_OUTPUT_TOKENS": os.environ.get("NMEM_DIM_E2E_MAX_OUTPUT_TOKENS", "").strip()
        or "8192",
    }
    if os.environ.get("NMEM_DIM_E2E_API_KEY"):
        env["DIM_API_KEY"] = os.environ["NMEM_DIM_E2E_API_KEY"]
    if not env["DIM_BASE_URL"] or not env["DIM_MODEL"]:
        pytest.skip(
            "set NMEM_DIM_E2E_BASE_URL and NMEM_DIM_E2E_MODEL to run a live Dim turn"
        )
    return env


def _run(command: list[str], *, env: dict[str, str], cwd: Path, timeout: int = 120) -> Any:
    return subprocess.run(
        command,
        env=env,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        timeout=timeout,
    )


def _nmem_json(args: list[str], *, env: dict[str, str], timeout: int = 30) -> Any:
    result = _run(["nmem", "--json", *args], env=env, cwd=Path(env["HOME"]), timeout=timeout)
    assert result.returncode == 0, (
        f"nmem {' '.join(args)} failed\nstdout:\n{result.stdout[-4000:]}\n"
        f"stderr:\n{result.stderr[-4000:]}"
    )
    stdout = result.stdout.strip()
    return json.loads(stdout) if stdout else {}


def _dim_env(root: Path, space: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    env = {
        "HOME": str(root / "home"),
        "DIMCODE_HOME": str(root / "dimhome"),
        "PATH": os.environ.get("PATH", ""),
        "TMPDIR": str(root / "tmp"),
        "TEMP": str(root / "tmp"),
        "TMP": str(root / "tmp"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "NMEM_SPACE": space,
        "NMEM_SPACE_ID": space,
    }
    if os.environ.get("NMEM_E2E_API_URL"):
        env["NMEM_API_URL"] = os.environ["NMEM_E2E_API_URL"]
    if os.environ.get("NMEM_E2E_API_KEY"):
        env["NMEM_API_KEY"] = os.environ["NMEM_E2E_API_KEY"]
    if os.environ.get("NMEM_MCP_URL"):
        env["NMEM_MCP_URL"] = os.environ["NMEM_MCP_URL"]
    if extra:
        env.update(extra)
    return env


def _session_id(out: str) -> str:
    for line in out.splitlines():
        try:
            message = json.loads(line)
        except ValueError:
            continue
        params = message.get("params") if isinstance(message, dict) else None
        if isinstance(params, dict) and isinstance(params.get("sessionId"), str):
            return params["sessionId"]
    return ""


def _poll_thread(
    *, marker: str, space: str, env: dict[str, str], timeout_seconds: int = 90
) -> dict[str, Any]:
    deadline = time.time() + timeout_seconds
    last: Any = None
    while time.time() < deadline:
        last = _nmem_json(
            ["t", "search", marker, "--source", "dim", "--space", space, "-n", "10"],
            env=env,
        )
        threads = last.get("threads", [])
        if threads and threads[0].get("id"):
            return _thread_show(threads[0]["id"], space, env)
        time.sleep(3)
    raise AssertionError(f"no captured dim thread found for marker {marker}; last={last}")


def _thread_show(thread_id: str, space: str, env: dict[str, str]) -> dict[str, Any]:
    result = _run(
        [
            "nmem",
            "--json",
            "t",
            "show",
            thread_id,
            "--space",
            space,
            "-n",
            "100",
            "--content-limit",
            "4000",
        ],
        env=env,
        cwd=Path(env["HOME"]),
    )
    if result.returncode != 0:
        return _nmem_json(["t", "show", thread_id, "--space", space, "-n", "100"], env=env)
    return json.loads(result.stdout.strip()) if result.stdout.strip() else {}


@pytest.fixture()
def live_dim(tmp_path: Path) -> Any:
    binary = _require_live_dim()
    root = tmp_path / "dim-e2e"
    for name in ("home", "dimhome", "workspace", "tmp"):
        (root / name).mkdir(parents=True)
    run_id = uuid.uuid4().hex[:10]
    space = os.environ.get("NMEM_E2E_SPACE") or f"nmem-dim-e2e-{run_id}"
    owns_space = not os.environ.get("NMEM_E2E_SPACE")
    marker = f"nmem-dim-e2e-{run_id}"
    env = _dim_env(root, space)
    if owns_space:
        _nmem_json(
            [
                "spaces",
                "create",
                space,
                "--description",
                f"Temporary Dim plugin E2E space {marker}",
                "--icon",
                "flask",
            ],
            env=env,
        )
    try:
        yield {
            "binary": binary,
            "root": root,
            "env": env,
            "space": space,
            "marker": marker,
        }
    finally:
        if not _bool_env("NMEM_E2E_KEEP_DATA"):
            try:
                threads = _nmem_json(
                    ["t", "search", marker, "--space", space, "-n", "50"], env=env
                )
                for thread in threads.get("threads", []):
                    if thread.get("id"):
                        _run(
                            ["nmem", "t", "delete", thread["id"], "--space", space, "-f"],
                            env=env,
                            cwd=Path(env["HOME"]),
                        )
            except Exception:
                pass
        if owns_space:
            try:
                _run(
                    ["nmem", "spaces", "delete", space, "-f", "--purge-working-memory"],
                    env=env,
                    cwd=Path(env["HOME"]),
                )
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Static contract tests (no Dim build or Mem server needed)
# ---------------------------------------------------------------------------


class TestManifest:
    def test_manifest_is_a_dim_plugin(self):
        manifest = json.loads((PLUGIN_DIR / "dim-plugin.json").read_text(encoding="utf-8"))
        assert manifest["name"] == "nowledge-mem"
        assert manifest["skills"] == "skills"
        assert manifest["mcp"] == "mcp.json"
        assert manifest["hooks"] == "hooks.json"
        assert "version" not in manifest, "Dim manifests have no version field"

    def test_every_referenced_file_exists(self):
        manifest = json.loads((PLUGIN_DIR / "dim-plugin.json").read_text(encoding="utf-8"))
        for key in ("skills", "mcp", "hooks"):
            assert (PLUGIN_DIR / manifest[key]).exists(), f"missing {manifest[key]}"


class TestHooks:
    def test_three_events_with_windowed_commands(self):
        hooks = json.loads((PLUGIN_DIR / "hooks.json").read_text(encoding="utf-8"))["hooks"]
        assert set(hooks) == set(HOOK_EVENTS)
        for event in HOOK_EVENTS:
            for group in hooks[event]:
                for handler in group["hooks"]:
                    assert handler["type"] == "command"
                    assert "run-hook.sh" in handler["command"]
                    assert "run-hook.ps1" in handler["commandWindows"]

    def test_startup_matches_only_startup(self):
        hooks = json.loads((PLUGIN_DIR / "hooks.json").read_text(encoding="utf-8"))["hooks"]
        assert hooks["SessionStart"][0]["matcher"] == "startup"

    def test_timeouts_and_async_capture(self):
        hooks = json.loads((PLUGIN_DIR / "hooks.json").read_text(encoding="utf-8"))["hooks"]
        start = hooks["SessionStart"][0]["hooks"][0]
        prompt = hooks["UserPromptSubmit"][0]["hooks"][0]
        stop = hooks["Stop"][0]["hooks"][0]
        assert start["timeout"] <= 12
        assert prompt["timeout"] <= 3
        assert stop["timeout"] <= 60
        assert stop.get("async") is True

    def test_capture_write_budget_stays_inside_the_timeout(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "dim_capture_budget", PLUGIN_DIR / "scripts" / "nmem_capture.py"
        )
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(module)
        assert module.TOTAL_BUDGET_SECONDS < 60


class TestMcp:
    def test_local_http_entry(self):
        servers = json.loads((PLUGIN_DIR / "mcp.json").read_text(encoding="utf-8"))["mcpServers"]
        entry = servers["nowledge-mem"]
        assert entry["type"] == "http"
        assert entry["url"].startswith("${NMEM_MCP_URL:-http://127.0.0.1:14242/mcp}")
        assert entry["headers"]["APP"] == "Dim"
        assert "X-NMEM-API-Key" not in entry["headers"]


class TestSkills:
    def test_five_skills_have_frontmatter(self):
        skills = PLUGIN_DIR / "skills"
        names = {path.name for path in skills.iterdir() if path.is_dir()}
        assert names == {
            "read-working-memory",
            "search-memory",
            "distill-memory",
            "explore-graph",
            "status",
        }
        for name in names:
            text = (skills / name / "SKILL.md").read_text(encoding="utf-8")
            assert text.startswith("---\n")
            assert "\nname:" in text
            assert "\ndescription:" in text


# ---------------------------------------------------------------------------
# Live smoke test (real Dim build, real nmem, real Mem)
# ---------------------------------------------------------------------------


def test_live_dim_installs_the_plugin_and_lists_three_hooks(live_dim: dict[str, Any]):
    root, env, binary = live_dim["root"], live_dim["env"], live_dim["binary"]

    install = _run(
        [binary, "--home", str(root / "dimhome"), "plugin", "install", str(PLUGIN_DIR)],
        env=env,
        cwd=root / "workspace",
        timeout=180,
    )
    assert install.returncode == 0, f"plugin install failed:\n{install.stdout}\n{install.stderr}"

    listing = _run(
        [binary, "--home", str(root / "dimhome"), "plugin", "list"],
        env=env,
        cwd=root / "workspace",
        timeout=60,
    )
    assert listing.returncode == 0, listing.stderr
    assert "nowledge-mem" in listing.stdout
    assert "enabled" in listing.stdout.lower()

    hooks = _run(
        [binary, "--home", str(root / "dimhome"), "hooks", "list"],
        env=env,
        cwd=root / "workspace",
        timeout=60,
    )
    assert hooks.returncode == 0, hooks.stderr
    rows = [line for line in hooks.stdout.splitlines() if "plugin:nowledge-mem" in line]
    assert len(rows) == 3, hooks.stdout
    for row in rows:
        assert "ok" in row.lower(), row
    assert "unsupported" not in hooks.stdout


def test_live_dim_session_is_captured_as_a_checkpointed_thread(live_dim: dict[str, Any]):
    root = live_dim["root"]
    binary = live_dim["binary"]
    space = live_dim["space"]
    marker = live_dim["marker"]
    env = _dim_env(root, space, _model_env())
    workspace = root / "workspace"
    dim = [binary, "--home", str(root / "dimhome")]

    install = _run(
        [*dim, "plugin", "install", str(PLUGIN_DIR)], env=env, cwd=workspace, timeout=180
    )
    assert install.returncode == 0, f"plugin install failed:\n{install.stdout}\n{install.stderr}"

    first_prompt = f"{marker} first operator turn"
    first = _exec_turn(dim, env, workspace, first_prompt, session_id=None)
    assert first.returncode == 0, f"first Dim turn failed:\n{first.stdout}\n{first.stderr}"
    session_id = _session_id(first.stdout)
    assert session_id, first.stdout

    thread = _poll_thread(marker=marker, space=space, env=env)
    assert thread.get("id") == f"dim-{session_id}"
    dumped = json.dumps(thread, ensure_ascii=False)
    assert marker in dumped
    assert "<dim-hooks" not in dumped, "injected hook guidance must not be captured"
    messages = thread.get("messages") or []
    assert len(messages) >= 2, dumped
    contents = [message.get("content", "") for message in messages]
    assert sum(marker in content for content in contents) == 1
    assert any(message.get("role") == "assistant" for message in messages)

    second_marker = marker + " second"
    second = _exec_turn(dim, env, workspace, f"{second_marker} operator turn", session_id)
    assert second.returncode == 0, f"second Dim turn failed:\n{second.stdout}\n{second.stderr}"

    grown = _poll_thread(marker=second_marker, space=space, env=env)
    assert grown.get("id") == f"dim-{session_id}"
    grown_messages = grown.get("messages") or []
    grown_contents = [message.get("content", "") for message in grown_messages]
    assert sum(second_marker in content for content in grown_contents) == 1
    assert sum(marker in content for content in grown_contents) == 1, (
        "the first turn was imported again instead of a delta"
    )
    assert len(grown_messages) > len(messages)


def _exec_turn(
    dim: list[str],
    env: dict[str, str],
    workspace: Path,
    prompt: str,
    session_id: str | None,
) -> Any:
    args = (
        [*dim, "exec", "--permission", "full-access", "--json"]
        if session_id is None
        else [*dim, "exec", "resume", session_id, "--json"]
    )
    process = subprocess.Popen(
        args,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        cwd=str(workspace),
    )
    # Dim reads the first input before connecting to the daemon; the Session
    # and the SessionStart hook need a moment, as they do in the app.
    time.sleep(4)
    try:
        out, err = process.communicate(input=prompt + "\n", timeout=300)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()
        raise
    return subprocess.CompletedProcess(args, process.returncode, out, err)
