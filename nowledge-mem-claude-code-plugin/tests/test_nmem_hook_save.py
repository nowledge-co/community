import importlib.util
import os
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).parent.parent / "scripts" / "nmem-hook-save.py"

spec = importlib.util.spec_from_file_location("nmem_hook_save", SCRIPT_PATH)
nmem_hook_save = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(nmem_hook_save)


def test_build_command_uses_unix_nmem_directly(tmp_path):
    command = nmem_hook_save._build_command(
        "/usr/local/bin/nmem",
        {"session_id": " claude-session ", "cwd": str(tmp_path)},
    )

    assert command == [
        "/usr/local/bin/nmem",
        "--json",
        "t",
        "save",
        "--from",
        "claude-code",
        "--truncate",
        "--session-id",
        "claude-session",
        "--project",
        str(tmp_path.resolve()),
    ]


def test_build_command_adds_space_from_environment(tmp_path):
    with patch.dict(os.environ, {"NMEM_SPACE": "Research Lane"}):
        command = nmem_hook_save._build_command(
            "/usr/local/bin/nmem",
            {"session_id": "session-1", "cwd": str(tmp_path)},
        )

    assert "--space" in command
    assert command[command.index("--space") + 1] == "research lane"


def test_build_command_adds_space_from_git_common_dir(tmp_path):
    project = tmp_path / "ExampleRepo"
    project.mkdir()
    subdir = project / "subdir"
    subdir.mkdir()
    with patch.dict(os.environ, {"NMEM_SPACE": ""}):
        nmem_hook_save.subprocess.run(
            ["git", "init", "-q"],
            cwd=str(project),
            check=True,
        )
        command = nmem_hook_save._build_command(
            "/usr/local/bin/nmem",
            {"session_id": "session-1", "cwd": str(subdir)},
        )

    assert "--space" in command
    assert command[command.index("--space") + 1] == "examplerepo"


def test_build_command_omits_space_outside_git_when_no_override(tmp_path):
    with patch.dict(os.environ, {"NMEM_SPACE": ""}):
        command = nmem_hook_save._build_command(
            "/usr/local/bin/nmem",
            {"session_id": "session-1", "cwd": str(tmp_path)},
        )

    assert "--space" not in command


def test_build_command_accepts_camel_case_claude_hook_payload(tmp_path):
    command = nmem_hook_save._build_command(
        "/usr/local/bin/nmem",
        {"sessionId": " camel-session ", "cwd": str(tmp_path)},
    )

    assert "--session-id" in command
    assert command[command.index("--session-id") + 1] == "camel-session"
    assert "--project" in command
    assert command[command.index("--project") + 1] == str(tmp_path.resolve())


def test_build_command_accepts_nested_claude_hook_payload(tmp_path):
    command = nmem_hook_save._build_command(
        "/usr/local/bin/nmem",
        {"data": {"input": {"sessionId": "nested-session", "cwd": str(tmp_path)}}},
    )

    assert "--session-id" in command
    assert command[command.index("--session-id") + 1] == "nested-session"
    assert "--project" in command
    assert command[command.index("--project") + 1] == str(tmp_path.resolve())


def test_build_command_resolves_project_symlink(tmp_path):
    real_project = tmp_path / "real-project"
    real_project.mkdir()
    linked_project = tmp_path / "linked-project"
    linked_project.symlink_to(real_project, target_is_directory=True)

    command = nmem_hook_save._build_command(
        "/usr/local/bin/nmem",
        {"session_id": "symlink-session", "cwd": str(linked_project)},
    )

    assert "--project" in command
    assert command[command.index("--project") + 1] == str(real_project.resolve())


def test_build_command_wraps_windows_cmd_for_wsl_bridge():
    command = nmem_hook_save._build_command(
        "/mnt/c/Users/Alice/AppData/Roaming/npm/nmem.cmd",
        {"session_id": "session-1"},
    )

    assert command[:3] == ["cmd.exe", "/s", "/c"]
    assert "C:\\Users\\Alice\\AppData\\Roaming\\npm\\nmem.cmd" in command[3]
    assert "/mnt/c/" not in command[3]
    assert "--json" in command[3]
    assert "--session-id session-1" in command[3]


def test_build_command_converts_wsl_project_path_for_windows_cmd():
    with patch.object(nmem_hook_save.shutil, "which", return_value=None), \
        patch.dict(nmem_hook_save.os.environ, {"WSL_DISTRO_NAME": "Ubuntu"}):
        command = nmem_hook_save._build_command(
            "/mnt/c/Users/Alice/AppData/Roaming/npm/nmem.cmd",
            {"session_id": "session-1", "cwd": "/home/alice/project"},
        )

    assert command[:3] == ["cmd.exe", "/s", "/c"]
    assert "\\\\wsl.localhost\\Ubuntu\\home\\alice\\project" in command[3]
    assert "--project /home/alice/project" not in command[3]


def test_run_capture_retries_until_nmem_reports_saved_result():
    calls = [
        CompletedProcess(["nmem"], 0, stdout='{"results":[]}', stderr=""),
        CompletedProcess(
            ["nmem"],
            0,
            stdout='{"results":[{"action":"created","session_id":"s1"}]}',
            stderr="",
        ),
    ]

    with patch.object(nmem_hook_save, "SAVE_RETRY_DELAYS_SECONDS", (0.0, 0.0)), \
        patch.object(nmem_hook_save.subprocess, "run", side_effect=calls) as run:
        captured, returncode, stderr = nmem_hook_save._run_capture_with_retries(
            ["/usr/local/bin/nmem", "--json", "t", "save"]
        )

    assert captured is True
    assert returncode == 0
    assert stderr == ""
    assert run.call_count == 2


def test_run_capture_reports_uncaptured_when_transcript_never_flushes():
    proc = CompletedProcess(["nmem"], 0, stdout='{"results":[]}', stderr="")

    with patch.object(nmem_hook_save, "SAVE_RETRY_DELAYS_SECONDS", (0.0, 0.0)), \
        patch.object(nmem_hook_save.subprocess, "run", return_value=proc):
        captured, returncode, stderr = nmem_hook_save._run_capture_with_retries(
            ["/usr/local/bin/nmem", "--json", "t", "save"]
        )

    assert captured is False
    assert returncode == 0
    assert stderr == ""


def test_run_capture_falls_back_for_legacy_nmem_without_json_support():
    calls = [
        CompletedProcess(
            ["nmem"],
            2,
            stdout="",
            stderr="No such option: --json",
        ),
        CompletedProcess(["nmem"], 0, stdout="", stderr=""),
    ]

    with patch.object(nmem_hook_save, "SAVE_RETRY_DELAYS_SECONDS", (0.0,)), \
        patch.object(nmem_hook_save, "_run_command", side_effect=calls) as run:
        captured, returncode, stderr = nmem_hook_save._run_capture_with_retries(
            ["/usr/local/bin/nmem", "--json", "t", "save"],
            ["/usr/local/bin/nmem", "t", "save"],
        )

    assert captured is True
    assert returncode == 0
    assert stderr == ""
    assert run.call_count == 2
    assert "--json" not in run.call_args_list[1].args[0]
