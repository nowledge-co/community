import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from unittest import mock

import pytest

PLUGIN_ROOT = Path(__file__).parent.parent
SCRIPT_PATH = PLUGIN_ROOT / "scripts" / "nmem-hook-context.py"
HOOKS_PATH = PLUGIN_ROOT / "hooks" / "hooks.json"


@pytest.fixture
def module(monkeypatch, tmp_path):
    for name in tuple(os.environ):
        if name.startswith(("NMEM_", "GROK_", "WSL_")) or name == "CLAUDE_PLUGIN_ROOT":
            monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    spec = importlib.util.spec_from_file_location("nmem_hook_context", SCRIPT_PATH)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def test_prompt_routing_survives_missing_cli_without_reloading_context(module, capsys):
    with mock.patch.object(module, "load_context") as read:
        assert module.main(event="UserPromptSubmit") == 0
    read.assert_not_called()
    response = json.loads(capsys.readouterr().out)
    context = response["hookSpecificOutput"]["additionalContext"]
    assert response["hookSpecificOutput"]["hookEventName"] == "UserPromptSubmit"
    assert "run one targeted" in context
    assert "not a substitute" in context
    assert "failed search as no matches" in context
    assert "systemMessage" not in response


@pytest.mark.parametrize(
    "source", ["Context Bundle", "Working Memory", "legacy Default-space briefing"]
)
def test_startup_receipt_names_actual_source(module, capsys, source):
    with mock.patch.object(
        module, "load_context", return_value=module.ContextRead("briefing", source)
    ):
        module.main()
    response = json.loads(capsys.readouterr().out)
    assert (
        response["systemMessage"] == f"[Nowledge Mem] Loaded session context: {source}."
    )
    assert "briefing" in response["hookSpecificOutput"]["additionalContext"]
    assert "searched" not in response["systemMessage"].lower()


@pytest.mark.parametrize(
    "reason",
    ["cli_unavailable", "cli_error", "timeout", "invalid_response", "no_briefing"],
)
def test_failed_or_empty_startup_keeps_guidance_and_truthful_receipt(
    module, capsys, reason
):
    with mock.patch.object(
        module, "load_context", return_value=module.ContextRead("", "", reason)
    ):
        module.main()
    response = json.loads(capsys.readouterr().out)
    assert "run one targeted" in response["hookSpecificOutput"]["additionalContext"]
    assert "Loaded" not in response["systemMessage"]
    assert (
        "No startup briefing" if reason == "no_briefing" else "unavailable"
    ) in response["systemMessage"]


def test_compaction_emits_one_json_envelope(module, capsys):
    with mock.patch.object(
        module,
        "load_context",
        return_value=module.ContextRead("briefing", "Context Bundle"),
    ):
        module.main(compact=True)
    response = json.loads(capsys.readouterr().out)
    assert (
        "Context was compacted" in response["hookSpecificOutput"]["additionalContext"]
    )


@pytest.mark.parametrize("event", ["SessionStart", "UserPromptSubmit"])
def test_grok_passive_hooks_do_not_read_or_emit(module, monkeypatch, capsys, event):
    monkeypatch.setenv("GROK_PLUGIN_ROOT", "/plugins/nowledge")
    with mock.patch.object(module, "load_context") as read:
        module.main(event=event)
    read.assert_not_called()
    assert capsys.readouterr().out == ""


def test_scoped_fallback_never_reads_default_lane_or_file(
    module, monkeypatch, tmp_path
):
    monkeypatch.setenv("NMEM_SPACE", "Research Lane")
    (tmp_path / "ai-now").mkdir()
    (tmp_path / "ai-now" / "memory.md").write_text("private default briefing")
    with (
        mock.patch.object(module, "find_nmem", return_value="/bin/nmem"),
        mock.patch.object(module, "read_json", return_value=({}, "cli_error")) as read,
    ):
        result = module.load_context()
    assert not result.content
    assert len(read.call_args_list) == 2
    for call in read.call_args_list:
        assert call.args[1][-2:] == ["--space", "Research Lane"]


def test_identity_only_failure_does_not_read_anonymous_working_memory(
    module, monkeypatch
):
    monkeypatch.setenv("NMEM_AGENT_ID", "reviewer")
    with (
        mock.patch.object(module, "find_nmem", return_value="/bin/nmem"),
        mock.patch.object(module, "read_json", return_value=({}, "cli_error")) as read,
    ):
        result = module.load_context()
    assert not result.content
    read.assert_called_once()
    assert read.call_args.args[1] == [
        "context",
        "--source-app",
        "claude-code",
        "--agent-id",
        "reviewer",
    ]


def test_scoped_working_memory_fallback_succeeds(module, monkeypatch):
    monkeypatch.setenv("NMEM_SPACE_ID", "legacy-lane")
    with (
        mock.patch.object(module, "find_nmem", return_value="/bin/nmem"),
        mock.patch.object(
            module,
            "read_json",
            side_effect=[
                ({}, "cli_error"),
                ({"exists": True, "content": "same lane"}, ""),
            ],
        ) as read,
    ):
        result = module.load_context()
    assert result == module.ContextRead("same lane", "Working Memory")
    assert read.call_args.args[1] == ["wm", "read", "--space-id", "legacy-lane"]


def test_context_and_working_memory_share_one_deadline(module):
    with (
        mock.patch.object(module, "find_nmem", return_value="/bin/nmem"),
        mock.patch.object(module.time, "monotonic", side_effect=[0, 0, 7]),
        mock.patch.object(
            module,
            "read_json",
            side_effect=[
                ({}, "timeout"),
                ({"content": "fallback"}, ""),
            ],
        ) as read,
    ):
        module.load_context()
    assert [call.args[2] for call in read.call_args_list] == [7, 3]


def test_expired_deadline_does_not_start_another_cli_attempt(module):
    with (
        mock.patch.object(module, "find_nmem", return_value="/bin/nmem"),
        mock.patch.object(module.time, "monotonic", side_effect=[0, 0, 10.1]),
        mock.patch.object(module, "read_json", return_value=({}, "timeout")) as read,
    ):
        result = module.load_context()
    read.assert_called_once()
    assert result.reason == "timeout"


@pytest.mark.parametrize(
    "name",
    [
        "NMEM_SPACE",
        "NMEM_SPACE_ID",
        "NMEM_AGENT_ID",
        "NMEM_APP_DATA",
        "NMEM_APP_CONFIG_DIR",
        "NMEM_CLI_CONFIG_DIR",
    ],
)
def test_local_file_is_not_a_fallback_for_another_scope(
    module, monkeypatch, tmp_path, name
):
    (tmp_path / "ai-now").mkdir()
    (tmp_path / "ai-now" / "memory.md").write_text("default only")
    monkeypatch.setenv(name, "other")
    assert module.local_fallback() == ""


@pytest.mark.parametrize(
    "stdout,code,reason",
    [
        ('{"content":"untrusted partial result"}', 2, "cli_error"),
        ('{"error":"authentication failed","content":"ignore"}', 0, "cli_error"),
        ('{"success":false,"content":"untrusted partial result"}', 0, "cli_error"),
        ("not-json", 0, "invalid_response"),
        ("[]", 0, "invalid_response"),
        ('{"content":"valid"}', 0, ""),
    ],
)
def test_cli_exit_status_and_response_shape_are_checked(module, stdout, code, reason):
    result = subprocess.CompletedProcess([], code, stdout, "private diagnostic")
    with mock.patch.object(module.subprocess, "run", return_value=result):
        payload, error = module.read_json("/bin/nmem", ["context"], 1)
    assert error == reason
    assert bool(payload) == (not reason)


def test_configured_cli_path_is_authoritative_and_can_contain_spaces(
    module, monkeypatch, tmp_path
):
    cli = tmp_path / "custom bin" / ("nmem.cmd" if os.name == "nt" else "nmem")
    cli.parent.mkdir()
    cli.write_text("#!/bin/sh\nexit 0\n")
    cli.chmod(0o755)
    monkeypatch.setenv("NMEM_CLI_PATH", str(cli))
    assert module.find_nmem() == str(cli)
    monkeypatch.setenv("NMEM_CLI_PATH", str(tmp_path / "missing"))
    assert module.find_nmem() is None


def test_direct_windows_shim_does_not_require_cmd_exe(module):
    assert module.command_args("/custom bin/nmem.cmd", ["--space", 'lane"2024']) == [
        "/custom bin/nmem.cmd",
        "--space",
        'lane"2024',
    ]


def test_wsl_windows_shim_uses_interop(module, monkeypatch):
    monkeypatch.setenv("WSL_DISTRO_NAME", "Ubuntu")
    command = module.command_args(
        "/mnt/c/Program Files/nmem.cmd", ["--json", "context"]
    )
    assert command[:4] == ["cmd.exe", "/d", "/s", "/c"]
    assert "C:\\Program Files\\nmem.cmd" in command[4]


@pytest.mark.parametrize(
    "event,index", [("SessionStart", 0), ("SessionStart", 1), ("UserPromptSubmit", 0)]
)
def test_packaged_hooks_produce_valid_json_in_an_installed_plugin(
    module, monkeypatch, tmp_path, event, index
):
    hooks = json.loads(HOOKS_PATH.read_text())["hooks"]
    hook = hooks[event][index]["hooks"][0]
    cli = tmp_path / ("fake nmem.cmd" if os.name == "nt" else "fake nmem")
    if os.name == "nt":
        cli.write_text('@echo off\necho {"rendered_markdown": "installed briefing"}\n')
    else:
        cli.write_text(
            f'#!{sys.executable}\nimport json\nprint(json.dumps({{"rendered_markdown": "installed briefing"}}))\n'
        )
    cli.chmod(0o755)
    monkeypatch.setenv("NMEM_CLI_PATH", str(cli))
    shell_root = PLUGIN_ROOT.as_posix()
    if os.name == "nt" and shell_root[1:3] == ":/":
        shell_root = f"/{shell_root[0].lower()}{shell_root[2:]}"
    monkeypatch.setenv("CLAUDE_PLUGIN_ROOT", shell_root)
    result = subprocess.run(
        [shutil.which("sh"), "-c", hook["command"]],
        env=os.environ.copy(),
        text=True,
        capture_output=True,
        timeout=15,
        check=False,
    )
    assert result.returncode == 0
    response = json.loads(result.stdout)
    assert response["hookSpecificOutput"]["hookEventName"] == event
    if event == "SessionStart":
        assert hook["statusMessage"]
        assert hook["timeout"] > module.TOTAL_TIMEOUT_SECONDS
        assert (
            "installed briefing" in response["hookSpecificOutput"]["additionalContext"]
        )
    else:
        assert (
            "installed briefing"
            not in response["hookSpecificOutput"]["additionalContext"]
        )


def test_claude_remains_cli_first_and_versions_match_registry():
    repository = PLUGIN_ROOT.parent
    registry = json.loads((repository / "integrations.json").read_text())
    by_id = {entry["id"]: entry for entry in registry["integrations"]}
    manifest = json.loads((PLUGIN_ROOT / ".claude-plugin" / "plugin.json").read_text())
    assert by_id["claude-code"]["transport"] == "cli"
    assert "mcpServers" not in manifest
    assert not (PLUGIN_ROOT / ".mcp.json").exists()
    assert (
        by_id["claude-code"]["version"]
        == by_id["grok"]["version"]
        == manifest["version"]
    )


def test_missing_python_emits_a_structured_unavailable_receipt(tmp_path):
    result = subprocess.run(
        [
            shutil.which("sh"),
            str(PLUGIN_ROOT / "scripts" / "nmem-hook-read.sh"),
            "--hook",
        ],
        env={"PATH": str(tmp_path), "CLAUDE_PLUGIN_ROOT": str(PLUGIN_ROOT)},
        text=True,
        capture_output=True,
        timeout=5,
        check=False,
    )
    assert result.returncode == 0
    response = json.loads(result.stdout)
    assert "Python is unavailable" in response["systemMessage"]
    assert "targeted" in response["hookSpecificOutput"]["additionalContext"]
