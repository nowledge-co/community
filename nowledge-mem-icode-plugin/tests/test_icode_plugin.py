"""Tests for the iCode plugin installer and hook script.

Pure-static: no network, no real nmem required. The nmem CLI is faked through
a PATH shim.
"""

from __future__ import annotations

import importlib.util
import json
import os
import stat
import subprocess
import sys
from pathlib import Path

import pytest

pytest.importorskip("yaml", reason="installer merge tests need PyYAML")

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
INSTALL_PY = PLUGIN_ROOT / "scripts" / "install.py"
HOOK_PY = PLUGIN_ROOT / "hooks" / "nmem_icode_hook.py"


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("USERPROFILE", str(home))
    monkeypatch.delenv("NMEM_API_URL", raising=False)
    monkeypatch.delenv("NMEM_API_KEY", raising=False)
    return home


def _write_nmem_config(home: Path, api_url: str, api_key: str) -> None:
    cfg_dir = home / ".nowledge-mem"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    (cfg_dir / "config.json").write_text(
        json.dumps({"apiUrl": api_url, "apiKey": api_key}), encoding="utf-8"
    )


def _install(fake_home: Path, tmp_path: Path, *extra: str) -> object:
    install = _load_module("nmem_icode_install_test", INSTALL_PY)
    config_dir = fake_home / ".chrys"
    skills_root = tmp_path / "skills"
    code = install.main(
        [
            "--config-dir",
            str(config_dir),
            "--skills-root",
            str(skills_root),
            *extra,
        ]
    )
    assert code == 0
    return install


def test_install_merges_mcp_and_hook_idempotently(fake_home, tmp_path):
    import yaml

    _write_nmem_config(fake_home, "http://127.0.0.1:14242", "nmem_testkey123")
    config_dir = fake_home / ".chrys"
    agents_dir = config_dir / "agents"
    agents_dir.mkdir(parents=True)
    profile = agents_dir / "Code.yaml"
    profile.write_text(
        "name: Code\nid: abc123\ntools:\n  mcp:\n  - name: other-server\n    transport: http\n    url: https://example.com/mcp\n",
        encoding="utf-8",
    )

    _install(fake_home, tmp_path)

    data = yaml.safe_load(profile.read_text(encoding="utf-8"))
    assert data["name"] == "Code"
    assert data["id"] == "abc123"
    names = [s["name"] for s in data["tools"]["mcp"]]
    assert names == ["other-server", "nowledge-mem"]
    ours = data["tools"]["mcp"][1]
    assert ours["url"] == "http://127.0.0.1:14242/mcp"
    assert ours["headers"]["Authorization"] == "Bearer nmem_testkey123"
    assert "memory_search" in ours["always_load"]

    hooks = yaml.safe_load((config_dir / "hooks" / "hooks.yaml").read_text(encoding="utf-8"))
    entry = hooks["hooks"][0]
    assert entry["id"] == "nowledge-mem-icode-context"
    assert entry["event"] == "user_prompt_submit"
    assert entry["execution"]["mode"] == "blocking"
    assert entry["run"]["path"] == "scripts/nmem_icode_hook.py"
    assert (config_dir / "hooks" / "scripts" / "nmem_icode_hook.py").exists()

    # Re-run: idempotent — no duplicate entries, other-server untouched.
    _install(fake_home, tmp_path)
    data = yaml.safe_load(profile.read_text(encoding="utf-8"))
    names = [s["name"] for s in data["tools"]["mcp"]]
    assert names == ["other-server", "nowledge-mem"]
    hooks = yaml.safe_load((config_dir / "hooks" / "hooks.yaml").read_text(encoding="utf-8"))
    ids = [h["id"] for h in hooks["hooks"]]
    assert ids == ["nowledge-mem-icode-context"]

    manifest = json.loads((config_dir / "nowledge-mem-icode-install.json").read_text(encoding="utf-8"))
    assert manifest["version"] == "0.1.0"


def test_install_never_prints_api_key(fake_home, tmp_path, capsys):
    _write_nmem_config(fake_home, "http://127.0.0.1:14242", "nmem_secret_do_not_print")
    _install(fake_home, tmp_path)
    assert "nmem_secret_do_not_print" not in capsys.readouterr().out


def test_remove_restores_original_entries(fake_home, tmp_path):
    import yaml

    _write_nmem_config(fake_home, "http://127.0.0.1:14242", "nmem_testkey123")
    config_dir = fake_home / ".chrys"
    agents_dir = config_dir / "agents"
    agents_dir.mkdir(parents=True)
    profile = agents_dir / "Code.yaml"
    profile.write_text(
        "name: Code\ntools:\n  mcp:\n  - name: other-server\n    transport: http\n    url: https://example.com/mcp\n",
        encoding="utf-8",
    )

    install = _load_module("nmem_icode_install_remove", INSTALL_PY)
    skills_root = tmp_path / "skills"
    assert install.main(["--config-dir", str(config_dir), "--skills-root", str(skills_root)]) == 0
    assert install.main(["--config-dir", str(config_dir), "--skills-root", str(skills_root), "--remove"]) == 0

    data = yaml.safe_load(profile.read_text(encoding="utf-8"))
    assert [s["name"] for s in data["tools"]["mcp"]] == ["other-server"]
    hooks = yaml.safe_load((config_dir / "hooks" / "hooks.yaml").read_text(encoding="utf-8"))
    assert hooks["hooks"] == []
    assert not (config_dir / "hooks" / "scripts" / "nmem_icode_hook.py").exists()
    assert not (config_dir / "nowledge-mem-icode-install.json").exists()
    for name in ("search-memory", "status"):
        assert not (skills_root / name).exists()


def _make_nmem_shim(tmp_path: Path, output: str) -> Path:
    bin_dir = tmp_path / "shim-bin"
    bin_dir.mkdir(exist_ok=True)
    shim = bin_dir / "nmem"
    shim.write_text(f'#!/bin/sh\necho "{output}"\n', encoding="utf-8")
    shim.chmod(shim.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return bin_dir


def _run_hook(fake_home: Path, tmp_path: Path, payload: dict) -> tuple[int, dict | None]:
    payload_file = tmp_path / "payload.json"
    payload_file.write_text(json.dumps(payload), encoding="utf-8")
    result_file = tmp_path / "result.json"
    env = {
        **os.environ,
        "HOME": str(fake_home),
        "USERPROFILE": str(fake_home),
        "CHRYS_HOOK_PAYLOAD_FILE": str(payload_file),
        "CHRYS_HOOK_RESULT": str(result_file),
    }
    proc = subprocess.run(
        [sys.executable, str(HOOK_PY)],
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )
    result = None
    if result_file.exists():
        result = json.loads(result_file.read_text(encoding="utf-8"))
    return proc.returncode, result


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX PATH shim")
def test_hook_injects_context_then_recall(fake_home, tmp_path, monkeypatch):
    bin_dir = _make_nmem_shim(tmp_path, "OWNER: Test Owner | SPACE: default")
    monkeypatch.setenv("PATH", str(bin_dir))

    code, result = _run_hook(
        fake_home,
        tmp_path,
        {"event": "user_prompt_submit", "session_id": "sess-1", "injected": False, "text": "hi"},
    )
    assert code == 0
    assert result is not None
    assert "Test Owner" in result["system_reminder"]

    # Same session, later prompt: recall reminder, no context repetition.
    code, result = _run_hook(
        fake_home,
        tmp_path,
        {"event": "user_prompt_submit", "session_id": "sess-1", "injected": False, "text": "again"},
    )
    assert code == 0
    assert result is not None
    assert "Test Owner" not in result["system_reminder"]
    assert "memory_search" in result["system_reminder"]


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX PATH shim")
def test_hook_fails_open_without_nmem(fake_home, tmp_path, monkeypatch):
    monkeypatch.setenv("PATH", str(tmp_path / "empty-bin"))

    code, result = _run_hook(
        fake_home,
        tmp_path,
        {"event": "user_prompt_submit", "session_id": "sess-2", "injected": False, "text": "hi"},
    )
    assert code == 0
    assert result is not None
    assert "memory_search" in result["system_reminder"]


def test_hook_ignores_other_events_and_bad_payloads(fake_home, tmp_path):
    code, result = _run_hook(
        fake_home, tmp_path, {"event": "after_turn", "status": "ok"}
    )
    assert code == 0
    assert result is None

    payload_file = tmp_path / "broken.json"
    payload_file.write_text("{not json", encoding="utf-8")
    result_file = tmp_path / "result2.json"
    env = {
        **os.environ,
        "HOME": str(fake_home),
        "CHRYS_HOOK_PAYLOAD_FILE": str(payload_file),
        "CHRYS_HOOK_RESULT": str(result_file),
    }
    proc = subprocess.run(
        [sys.executable, str(HOOK_PY)], capture_output=True, text=True, env=env, timeout=30
    )
    assert proc.returncode == 0
    assert not result_file.exists()
