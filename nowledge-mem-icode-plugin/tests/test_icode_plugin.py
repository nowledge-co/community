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
    monkeypatch.delenv("NMEM_CLI_CONFIG_DIR", raising=False)
    return home


def _write_nmem_config(home: Path, api_url: str, api_key: str) -> None:
    cfg_dir = home / "AppData" / "Roaming" / ".nowledge-mem" if sys.platform == "win32" else home / ".nowledge-mem"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    (cfg_dir / "config.json").write_text(
        json.dumps({"apiUrl": api_url, "apiKey": api_key}), encoding="utf-8"
    )


def _install(fake_home: Path, tmp_path: Path, *extra: str) -> object:
    install = _load_module("nmem_icode_install_test", INSTALL_PY)
    config_dir = fake_home / ".chrys"
    skills_root = tmp_path / "skills"
    profile = config_dir / "agents" / "Code.yaml"
    if not profile.exists():
        profile.parent.mkdir(parents=True, exist_ok=True)
        profile.write_text("name: Code\nid: abc123\ntools: {}\n", encoding="utf-8")
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


def test_dry_run_creates_nothing(fake_home, tmp_path):
    install = _load_module("install_dry", INSTALL_PY)
    config = tmp_path / "absent-config"
    skills = tmp_path / "absent-skills"
    assert install.main(["--config-dir", str(config), "--skills-root", str(skills), "--dry-run"]) == 0
    assert not config.exists()
    assert not skills.exists()


def test_remove_preserves_foreign_skills_across_update(fake_home, tmp_path):
    skills = tmp_path / "skills"
    foreign = skills / "search-memory" / "SKILL.md"
    foreign.parent.mkdir(parents=True)
    foreign.write_text("another connector's skill", encoding="utf-8")
    install = _install(fake_home, tmp_path)
    _install(fake_home, tmp_path)
    install.main(["--config-dir", str(fake_home / ".chrys"), "--remove"])
    assert foreign.read_text() == "another connector's skill"


def test_remove_preserves_user_modified_owned_skill(fake_home, tmp_path):
    install = _install(fake_home, tmp_path)
    skill = tmp_path / "skills" / "status" / "SKILL.md"
    skill.write_text("user customization", encoding="utf-8")
    install.main(["--config-dir", str(fake_home / ".chrys"), "--remove"])
    assert skill.read_text() == "user customization"


def test_missing_profile_is_rejected_without_writes(fake_home, tmp_path):
    install = _load_module("install_absent", INSTALL_PY)
    config = tmp_path / "absent"
    with pytest.raises(SystemExit):
        install.main(["--config-dir", str(config), "--skills-root", str(tmp_path / "skills")])
    assert not config.exists()


def test_endpoint_override_does_not_reuse_another_servers_key(fake_home, monkeypatch):
    _write_nmem_config(fake_home, "https://cloud.example", "original-key")
    monkeypatch.setenv("NMEM_API_URL", "https://different.example")
    install = _load_module("install_endpoint", INSTALL_PY)
    with pytest.raises(SystemExit):
        install._resolve_endpoint()


def test_no_yaml_is_preview_only(fake_home, tmp_path, monkeypatch):
    install = _load_module("install_no_yaml", INSTALL_PY)
    monkeypatch.setattr(install, "_yaml", lambda: None)
    target = tmp_path / "config"
    assert install.main(["--config-dir", str(target), "--skills-root", str(tmp_path / "skills")]) == 0
    assert not target.exists()
    assert not (tmp_path / "skills").exists()


def test_update_rejects_changed_skills_root_before_writes(fake_home, tmp_path):
    install = _install(fake_home, tmp_path)
    config = fake_home / ".chrys"
    before = (config / install.MANIFEST_NAME).read_bytes()
    with pytest.raises(SystemExit):
        install.main(["--config-dir", str(config), "--skills-root", str(tmp_path / "different")])
    assert (config / install.MANIFEST_NAME).read_bytes() == before
    assert not (tmp_path / "different").exists()


def test_update_preserves_edited_mcp_and_remove_leaves_it(fake_home, tmp_path):
    import yaml
    install = _install(fake_home, tmp_path)
    config = fake_home / ".chrys"
    profile = config / "agents" / "Code.yaml"
    data = yaml.safe_load(profile.read_text())
    data["tools"]["mcp"][0]["timeout"] = 42
    profile.write_text(yaml.safe_dump(data))
    before = profile.read_bytes()
    with pytest.raises(SystemExit):
        _install(fake_home, tmp_path)
    assert profile.read_bytes() == before
    install.main(["--config-dir", str(config), "--remove"])
    assert profile.read_bytes() == before


def test_remove_validates_manifest_before_editing_config(fake_home, tmp_path):
    install = _install(fake_home, tmp_path)
    config = fake_home / ".chrys"
    profile = config / "agents" / "Code.yaml"
    manifest_path = config / install.MANIFEST_NAME
    manifest = json.loads(manifest_path.read_text())
    manifest["managed"][str(tmp_path / "unrelated")] = {"digest": "bogus", "backup": None}
    manifest_path.write_text(json.dumps(manifest))
    before = profile.read_bytes()
    with pytest.raises(SystemExit):
        install.main(["--config-dir", str(config), "--remove"])
    assert profile.read_bytes() == before


def test_remove_missing_backup_preserves_install(fake_home, tmp_path):
    skill = tmp_path / "skills" / "status" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("foreign")
    install = _install(fake_home, tmp_path, "--force")
    config = fake_home / ".chrys"
    manifest = json.loads((config / install.MANIFEST_NAME).read_text())
    backup = Path(manifest["managed"][str(skill.parent)]["backup"])
    backup.rename(backup.with_name("temporarily-moved"))
    before = skill.read_bytes()
    with pytest.raises(SystemExit):
        install.main(["--config-dir", str(config), "--remove"])
    assert skill.read_bytes() == before


def test_hook_without_session_does_not_inject(tmp_path, monkeypatch):
    hook = _load_module("hook_missing_session", HOOK_PY)
    payload = tmp_path / "payload.json"
    payload.write_text(json.dumps({"event": "user_prompt_submit"}))
    result = tmp_path / "result.json"
    monkeypatch.setenv("CHRYS_HOOK_PAYLOAD_FILE", str(payload))
    monkeypatch.setenv("CHRYS_HOOK_RESULT", str(result))
    assert hook.main() == 0
    assert not result.exists()


def test_force_restore_foreign_skill_and_original_mcp(fake_home, tmp_path):
    import yaml
    profile = fake_home / ".chrys" / "agents" / "Code.yaml"
    profile.parent.mkdir(parents=True)
    original = {"name": "nowledge-mem", "url": "https://old.example/mcp"}
    profile.write_text(yaml.safe_dump({"name": "Code", "tools": {"mcp": [original]}}))
    skill = tmp_path / "skills" / "status" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("original skill")
    install = _install(fake_home, tmp_path, "--force")
    _install(fake_home, tmp_path)
    install.main(["--config-dir", str(fake_home / ".chrys"), "--remove"])
    assert skill.read_text() == "original skill"
    assert yaml.safe_load(profile.read_text())["tools"]["mcp"] == [original]


def test_hook_marks_only_after_result_written(tmp_path, monkeypatch):
    hook = _load_module("hook_result_failure", HOOK_PY)
    monkeypatch.setattr(hook, "_state_dir", lambda: tmp_path)
    monkeypatch.setattr(hook, "_load_context", lambda timeout: "recovered context")
    payload = tmp_path / "payload.json"
    payload.write_text(json.dumps({"event": "user_prompt_submit", "session_id": "test"}))
    monkeypatch.setenv("CHRYS_HOOK_PAYLOAD_FILE", str(payload))
    monkeypatch.setenv("CHRYS_HOOK_RESULT", str(tmp_path))
    assert hook.main() == 0
    key = hook._safe_session_key(json.loads(payload.read_text()))
    assert not hook._already_injected(key)
    monkeypatch.setenv("CHRYS_HOOK_RESULT", str(tmp_path / "result.json"))
    assert hook.main() == 0
    assert hook._already_injected(key)


def test_hook_session_and_scope_keys_do_not_collide(monkeypatch):
    hook = _load_module("hook_keys", HOOK_PY)
    assert hook._safe_session_key({"session_id": "a/b"}) != hook._safe_session_key({"session_id": "a_b"})
    original = hook._safe_session_key({"session_id": "same"})
    monkeypatch.setenv("NMEM_SPACE", "another lane")
    assert hook._safe_session_key({"session_id": "same"}) != original


def test_hook_fallback_stays_within_total_budget(monkeypatch):
    hook = _load_module("hook_budget", HOOK_PY)
    monkeypatch.setattr(hook, "_nmem_argv", lambda: ["nmem"])
    ticks = iter([100.0, 106.0])
    monkeypatch.setattr(hook.time, "monotonic", lambda: next(ticks))
    calls = []
    def run(prefix, args, timeout):
        calls.append((args, timeout))
        return None
    monkeypatch.setattr(hook, "_run_nmem", run)
    assert hook._load_context(8) is None
    assert calls == [(["context", "--source-app", "icode"], 6), (["working-memory"], 2)]


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
