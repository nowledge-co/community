import importlib.util
import hashlib
import json
import os
import time
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
        "capture",
        "--from",
        "claude-code",
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


def test_build_command_uses_grok_runtime_from_claude_compat_plugin_root(tmp_path):
    plugin_root = tmp_path / ".grok" / "installed-plugins" / "nowledge-mem-claude-code-plugin"
    with patch.dict(
        os.environ,
        {
            "CLAUDE_PLUGIN_ROOT": str(plugin_root),
            "GROK_PLUGIN_ROOT": "",
            "GROK_SESSION_ID": "",
            "GROK_WORKSPACE_ROOT": "",
            "GROK_HOOK_EVENT": "",
            "NMEM_SPACE": "",
        },
    ):
        command = nmem_hook_save._build_command(
            "/usr/local/bin/nmem",
            {"session_id": "grok-compat-session", "cwd": str(tmp_path)},
        )

    assert "--from" in command
    assert command[command.index("--from") + 1] == "grok"
    assert "--session-id" in command
    assert command[command.index("--session-id") + 1] == "grok-compat-session"


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


def test_build_command_preserves_spaces_in_windows_cmd_path():
    command = nmem_hook_save._build_command(
        r"C:\Users\Alice\AppData\Local\Nowledge Mem CLI\bin\nmem.cmd",
        {"session_id": "session-with-spaces"},
    )

    assert command[:3] == ["cmd.exe", "/s", "/c"]
    assert command[3].startswith(
        r'""C:\Users\Alice\AppData\Local\Nowledge Mem CLI\bin\nmem.cmd"'
    )
    assert command[3].endswith('"')
    assert "--session-id session-with-spaces" in command[3]


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


def test_run_capture_retries_until_nmem_acknowledges_enqueue():
    calls = [
        CompletedProcess(["nmem"], 0, stdout='{"status":"success"}', stderr=""),
        CompletedProcess(
            ["nmem"],
            0,
            stdout='{"status":"enqueued"}',
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


def test_background_dispatch_returns_one_worker_for_overlapping_stops(tmp_path):
    state_root = tmp_path / "hook-state"
    first = {"session_id": "session-1", "transcript_path": "/tmp/one.jsonl"}
    second = {
        "session_id": "session-1",
        "transcript_path": "/tmp/one.jsonl",
        "cwd": "/tmp/project",
    }

    with patch.object(nmem_hook_save, "_background_state_root", return_value=state_root), \
        patch.object(nmem_hook_save.subprocess, "Popen") as popen:
        nmem_hook_save._dispatch_background_capture(first, "stop")
        nmem_hook_save._dispatch_background_capture(second, "stop")
        assert popen.call_count == 1
        key = nmem_hook_save._background_session_key(first)
        assert nmem_hook_save._background_lease_path(key).exists()
        assert len(list(nmem_hook_save._background_queue_dir(key).glob("*.json"))) == 2


def test_background_worker_coalesces_to_latest_session_payload(tmp_path):
    state_root = tmp_path / "hook-state"
    first = {"session_id": "session-1", "transcript_path": "/tmp/one.jsonl"}
    second = {
        "session_id": "session-1",
        "transcript_path": "/tmp/one.jsonl",
        "turn": "latest",
    }
    key = nmem_hook_save._background_session_key(first)

    with patch.object(nmem_hook_save, "_background_state_root", return_value=state_root), \
        patch.object(nmem_hook_save.subprocess, "Popen"), \
        patch.object(nmem_hook_save, "_capture_payload", return_value=0) as capture:
        nmem_hook_save._dispatch_background_capture(first, "stop")
        nmem_hook_save._enqueue_background_payload(key, second)
        lease_token = nmem_hook_save._background_lease_path(key).read_text().split()[0]
        assert nmem_hook_save._drain_background_capture(key, "stop", lease_token) == 0
        capture.assert_called_once_with("stop", second)
        assert not nmem_hook_save._background_lease_path(key).exists()
        assert not list(nmem_hook_save._background_queue_dir(key).glob("*.json"))


def test_stale_worker_cannot_release_successor_lease(tmp_path):
    state_root = tmp_path / "hook-state"
    key = "session-key"

    with patch.object(nmem_hook_save, "_background_state_root", return_value=state_root):
        first_token = nmem_hook_save._claim_background_worker(key)
        assert first_token is not None
        lease = nmem_hook_save._background_lease_path(key)
        stale_at = time.time() - nmem_hook_save.BACKGROUND_LEASE_STALE_SECONDS - 1
        os.utime(lease, (stale_at, stale_at))
        second_token = nmem_hook_save._claim_background_worker(key)
        assert second_token is not None
        assert second_token != first_token

        nmem_hook_save._release_background_worker(key, first_token)
        assert lease.exists()
        assert nmem_hook_save._background_lease_owned(key, second_token)

        nmem_hook_save._release_background_worker(key, second_token)
        assert not lease.exists()


def test_background_spawn_is_detached_on_windows():
    with patch.object(nmem_hook_save.sys, "platform", "win32"):
        kwargs = nmem_hook_save._background_spawn_kwargs(object())

    assert kwargs["creationflags"] == 0x08000208
    assert "start_new_session" not in kwargs


def test_background_spawn_starts_new_session_on_posix():
    with patch.object(nmem_hook_save.sys, "platform", "darwin"):
        kwargs = nmem_hook_save._background_spawn_kwargs(object())

    assert kwargs["start_new_session"] is True
    assert "creationflags" not in kwargs


def test_stop_detach_reads_stdin_before_dispatch():
    payload = {"session_id": "session-1", "transcript_path": "/tmp/one.jsonl"}
    argv = ["nmem-hook-save.py", "--event", "stop", "--detach"]

    with patch.object(nmem_hook_save.sys, "argv", argv), \
        patch.object(nmem_hook_save.sys, "stdin") as stdin, \
        patch.object(nmem_hook_save, "_dispatch_background_capture") as dispatch:
        stdin.read.return_value = json.dumps(payload)
        assert nmem_hook_save.main() == 0

    dispatch.assert_called_once_with(payload, "stop")


def test_session_end_detach_reads_stdin_before_dispatch():
    payload = {"session_id": "grok-session", "cwd": "/tmp/grok-project"}
    argv = ["nmem-hook-save.py", "--event", "session-end", "--detach"]

    with patch.object(nmem_hook_save.sys, "argv", argv), \
        patch.object(nmem_hook_save.sys, "stdin") as stdin, \
        patch.object(nmem_hook_save, "_dispatch_background_capture") as dispatch:
        stdin.read.return_value = json.dumps(payload)
        assert nmem_hook_save.main() == 0

    dispatch.assert_called_once_with(payload, "session-end")


def test_subagent_stop_detach_reads_stdin_before_dispatch():
    payload = {"session_id": "grok-subagent-session", "cwd": "/tmp/grok-project"}
    argv = ["nmem-hook-save.py", "--event", "subagent-stop", "--detach"]

    with patch.object(nmem_hook_save.sys, "argv", argv), \
        patch.object(nmem_hook_save.sys, "stdin") as stdin, \
        patch.object(nmem_hook_save, "_dispatch_background_capture") as dispatch:
        stdin.read.return_value = json.dumps(payload)
        assert nmem_hook_save.main() == 0

    dispatch.assert_called_once_with(payload, "subagent-stop")


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


def test_build_command_requires_exact_session_identity():
    with patch.dict(os.environ, {"GROK_SESSION_ID": ""}):
        assert nmem_hook_save._build_command("nmem", {}) == []


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


def test_extract_skill_outcomes_ignores_non_skill_style_ids(tmp_path):
    transcript = tmp_path / "claude-transcript-non-skill-id.jsonl"
    transcript.write_text(
        json_line(
            {
                "type": "mcp_tool_call_end",
                "server": "nowledge-mem",
                "tool": "find_skills",
                "result": {
                    "matches": [
                        {
                            "skill_id": "bravo",
                            "version": "7",
                            "name": "Bravo",
                        }
                    ]
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )

    assert nmem_hook_save.extract_skill_outcomes_from_file(str(transcript)) == []


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


def expected_background_key(runtime, **identity):
    encoded = json.dumps(
        {"runtime": runtime, **identity},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def test_build_command_prefers_claude_project_dir_over_payload_cwd(tmp_path):
    project = tmp_path / "project"
    grok_workspace = tmp_path / "grok-workspace"
    subdir = project / "deep" / "subdir"
    subdir.mkdir(parents=True)
    grok_workspace.mkdir()

    with patch.dict(
        os.environ,
        {
            "CLAUDE_PROJECT_DIR": str(project),
            "GROK_WORKSPACE_ROOT": str(grok_workspace),
        },
    ):
        command = nmem_hook_save._build_command(
            "/usr/local/bin/nmem",
            {"session_id": "session-1", "cwd": str(subdir)},
        )

    assert command[command.index("--project") + 1] == str(project.resolve())


def test_background_session_key_prefers_claude_project_dir_over_grok_and_payload_cwd(tmp_path):
    project = tmp_path / "project"
    grok_workspace = tmp_path / "grok-workspace"
    payload_cwd = project / "deep" / "subdir"
    payload_cwd.mkdir(parents=True)
    grok_workspace.mkdir()

    with patch.dict(
        os.environ,
        {
            "CLAUDE_PROJECT_DIR": str(project),
            "GROK_WORKSPACE_ROOT": str(grok_workspace),
        },
    ), patch.object(nmem_hook_save, "_host_runtime", return_value="claude-code"):
        key = nmem_hook_save._background_session_key({"cwd": str(payload_cwd)})

    assert key == expected_background_key("claude-code", cwd=str(project))


def test_build_command_prefers_grok_workspace_root_over_payload_cwd(tmp_path):
    workspace = tmp_path / "workspace"
    subdir = tmp_path / "elsewhere"
    workspace.mkdir()
    subdir.mkdir()

    with patch.dict(os.environ, {"GROK_WORKSPACE_ROOT": str(workspace)}):
        os.environ.pop("CLAUDE_PROJECT_DIR", None)
        command = nmem_hook_save._build_command(
            "/usr/local/bin/nmem",
            {"session_id": "session-1", "cwd": str(subdir)},
        )

    assert command[command.index("--project") + 1] == str(workspace.resolve())


def test_background_session_key_prefers_grok_workspace_root_over_payload_cwd(tmp_path):
    workspace = tmp_path / "workspace"
    subdir = tmp_path / "elsewhere"
    workspace.mkdir()
    subdir.mkdir()

    with patch.dict(os.environ, {"GROK_WORKSPACE_ROOT": str(workspace)}), \
        patch.object(nmem_hook_save, "_host_runtime", return_value="grok"):
        os.environ.pop("CLAUDE_PROJECT_DIR", None)
        key = nmem_hook_save._background_session_key({"cwd": str(subdir)})

    assert key == expected_background_key("grok", cwd=str(workspace))


def test_build_command_falls_back_to_payload_cwd_without_env(tmp_path):
    with patch.dict(os.environ):
        os.environ.pop("CLAUDE_PROJECT_DIR", None)
        os.environ.pop("GROK_WORKSPACE_ROOT", None)
        command = nmem_hook_save._build_command(
            "/usr/local/bin/nmem",
            {"session_id": "session-1", "cwd": str(tmp_path)},
        )

    assert command[command.index("--project") + 1] == str(tmp_path.resolve())


def test_background_session_key_falls_back_to_payload_cwd_without_env(tmp_path):
    with patch.dict(os.environ), \
        patch.object(nmem_hook_save, "_host_runtime", return_value="claude-code"):
        os.environ.pop("CLAUDE_PROJECT_DIR", None)
        os.environ.pop("GROK_WORKSPACE_ROOT", None)
        key = nmem_hook_save._background_session_key({"cwd": str(tmp_path)})

    assert key == expected_background_key("claude-code", cwd=str(tmp_path))
