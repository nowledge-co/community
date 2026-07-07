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


def test_build_command_never_derives_space_from_git(tmp_path):
    # Space is user-owned: inside a git repo but with no explicit $NMEM_SPACE,
    # the hook must NOT derive a repo-named space. The old git-basename
    # derivation surfaced auto-created spaces the user never made (e.g. reading
    # an open-source repo spawned a space). No --space => default space.
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

    assert "--space" not in command


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


def test_build_command_uses_grok_runtime_env(tmp_path):
    with patch.dict(
        os.environ,
        {
            "GROK_SESSION_ID": "grok-session",
            "GROK_WORKSPACE_ROOT": str(tmp_path),
            "GROK_HOOK_EVENT": "Stop",
            "NMEM_SPACE": "",
        },
    ):
        command = nmem_hook_save._build_command("/usr/local/bin/nmem", {})

    assert "--from" in command
    assert command[command.index("--from") + 1] == "grok"
    assert "--session-id" in command
    assert command[command.index("--session-id") + 1] == "grok-session"
    assert "--project" in command
    assert command[command.index("--project") + 1] == str(tmp_path.resolve())


def test_build_command_uses_grok_runtime_from_plugin_root_only(tmp_path):
    with patch.dict(
        os.environ,
        {
            "GROK_PLUGIN_ROOT": str(tmp_path / "plugin"),
            "GROK_SESSION_ID": "",
            "GROK_WORKSPACE_ROOT": "",
            "GROK_HOOK_EVENT": "",
            "NMEM_SPACE": "",
        },
    ):
        command = nmem_hook_save._build_command(
            "/usr/local/bin/nmem",
            {"session_id": "plugin-root-session", "cwd": str(tmp_path)},
        )

    assert "--from" in command
    assert command[command.index("--from") + 1] == "grok"
    assert "--session-id" in command
    assert command[command.index("--session-id") + 1] == "plugin-root-session"


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


def test_run_command_hides_child_console_on_windows():
    proc = CompletedProcess(["nmem"], 0, stdout='{"results":[]}', stderr="")

    with patch.object(nmem_hook_save.sys, "platform", "win32"), \
        patch.object(nmem_hook_save.subprocess, "run", return_value=proc) as run:
        nmem_hook_save._run_command(["nmem.cmd", "--version"], 5)

    assert run.call_args.kwargs["creationflags"] == 0x08000000


def test_run_command_does_not_pass_windows_creationflags_on_posix():
    proc = CompletedProcess(["nmem"], 0, stdout='{"results":[]}', stderr="")

    with patch.object(nmem_hook_save.sys, "platform", "darwin"), \
        patch.object(nmem_hook_save.subprocess, "run", return_value=proc) as run:
        nmem_hook_save._run_command(["nmem", "--version"], 5)

    assert "creationflags" not in run.call_args.kwargs


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


def test_run_capture_reports_json_stdout_errors():
    proc = CompletedProcess(
        ["nmem"],
        1,
        stdout='{"error":"path_not_found","path":"/missing"}',
        stderr="",
    )

    with patch.object(nmem_hook_save, "SAVE_RETRY_DELAYS_SECONDS", (0.0,)), \
        patch.object(nmem_hook_save.subprocess, "run", return_value=proc):
        captured, returncode, stderr = nmem_hook_save._run_capture_with_retries(
            ["/usr/local/bin/nmem", "--json", "t", "save"]
        )

    assert captured is False
    assert returncode == 1
    assert "path_not_found" in stderr


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


def test_extract_skill_outcomes_from_claude_tool_use_pair(tmp_path):
    transcript = tmp_path / "claude-transcript.jsonl"
    transcript.write_text(
        "\n".join(
            [
                json_line(
                    {
                        "message": {
                            "content": [
                                {
                                    "type": "tool_use",
                                    "id": "toolu_1",
                                    "name": "mcp__nowledge-mem__find_skills",
                                    "input": {"query": "optimize UI"},
                                }
                            ]
                        }
                    }
                ),
                json_line(
                    {
                        "message": {
                            "content": [
                                {
                                    "type": "tool_result",
                                    "tool_use_id": "toolu_1",
                                    "content": json_line(
                                        {
                                            "skills": [
                                                {
                                                    "id": "skill-bravo",
                                                    "version": 7,
                                                    "name": "Bravo",
                                                }
                                            ]
                                        }
                                    ),
                                }
                            ]
                        }
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    assert nmem_hook_save.extract_skill_outcomes_from_file(str(transcript)) == [
        ("skill-bravo", "7")
    ]


def test_extract_skill_outcomes_defaults_missing_version_to_v1(tmp_path):
    transcript = tmp_path / "claude-transcript-v1.jsonl"
    transcript.write_text(
        json_line(
            {
                "type": "mcp_tool_call_end",
                "server": "nowledge-mem",
                "tool": "find_skills",
                "result": {
                    "matches": [
                        {
                            "id": "skill-bravo",
                            "name": "Bravo",
                            "title": "Bravo Skill",
                            "description": "A managed skill",
                        }
                    ]
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )

    assert nmem_hook_save.extract_skill_outcomes_from_file(str(transcript)) == [
        ("skill-bravo", "1")
    ]


def test_report_skill_outcomes_runs_once_per_transcript_skill_version(tmp_path):
    transcript = tmp_path / "claude-transcript.jsonl"
    transcript.write_text(
        json_line(
            {
                "type": "mcp_tool_call_end",
                "server": "nowledge-mem",
                "tool": "find_skills",
                "result": {
                    "matches": [
                        {"skill_id": "skill-bravo", "version": "7", "name": "Bravo"}
                    ]
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )
    payload = {"session_id": "claude-session", "transcript_path": str(transcript)}
    proc = CompletedProcess(["nmem"], 0, stdout="", stderr="")

    with patch.dict(os.environ, {"XDG_CACHE_HOME": str(tmp_path / "cache")}), \
        patch.object(nmem_hook_save, "_run_command", return_value=proc) as run:
        nmem_hook_save._report_skill_outcomes("/usr/local/bin/nmem", payload)
        nmem_hook_save._report_skill_outcomes("/usr/local/bin/nmem", payload)

    assert run.call_count == 1
    assert run.call_args.args[0] == [
        "/usr/local/bin/nmem",
        "skills",
        "outcome",
        "skill-bravo",
        "--version",
        "7",
        "--outcome",
        "completed",
    ]


def json_line(value):
    import json

    return json.dumps(value, separators=(",", ":"))
