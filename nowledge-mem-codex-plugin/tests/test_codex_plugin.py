import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOOK_MODULE_PATH = PLUGIN_ROOT / "hooks" / "nmem-stop-save.py"
LAUNCH_MODULE_PATH = PLUGIN_ROOT / "hooks" / "nmem-stop-launch.py"
CONTEXT_MODULE_PATH = PLUGIN_ROOT / "hooks" / "nmem-context.py"
RUNTIME_MODULE_PATH = PLUGIN_ROOT / "hooks" / "nmem_runtime.py"
INSTALL_MODULE_PATH = PLUGIN_ROOT / "scripts" / "install_hooks.py"
HOOKS_JSON_PATH = PLUGIN_ROOT / "hooks" / "hooks.json"


def load_module(module_name: str, module_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class HookTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module("nmem_stop_save", HOOK_MODULE_PATH)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)
        self.env_patch = mock.patch.dict(
            self.module.os.environ,
            {"CODEX_HOME": str(self.temp_path / ".codex")},
            clear=False,
        )
        self.env_patch.start()
        self.module._log_path = lambda: self.temp_path / "nmem-stop-hook.log"

    def tearDown(self):
        self.env_patch.stop()
        self.temp_dir.cleanup()

    def test_build_command_uses_codex_session_id_and_project(self):
        command = self.module._build_save_command(
            "/usr/local/bin/nmem",
            {"session_id": "019abc", "cwd": "/tmp/project"},
            include_session_id=True,
        )

        self.assertEqual(
            command,
            [
                "/usr/local/bin/nmem",
                "--json",
                "t",
                "save",
                "--from",
                "codex",
                "--truncate",
                "--project",
                str(Path("/tmp/project").expanduser()),
                "--session-id",
                "019abc",
            ],
        )

    def test_build_save_command_delegates_windows_shim_to_runtime(self):
        nmem = r"C:\Users\jockie\AppData\Local\Nowledge Mem\cli\nmem.CMD"
        bridged = [r"C:\Windows\System32\cmd.exe", "/d", "/s", "/c", "command"]
        with mock.patch.object(
            self.module,
            "_build_nmem_command",
            return_value=bridged,
        ) as build:
            command = self.module._build_save_command(
                nmem,
                {"session_id": "019abc", "cwd": r"D:\server-prod-env-setting"},
                include_session_id=True,
            )

        self.assertEqual(command, bridged)
        build.assert_called_once()
        self.assertEqual(build.call_args.args[0], nmem)
        self.assertIn("--project", build.call_args.args)
        self.assertIn("--session-id", build.call_args.args)

    def test_retry_without_session_id_on_lookup_miss(self):
        calls = []

        def fake_run(nmem, payload, *, include_session_id):
            calls.append(include_session_id)
            proc = mock.Mock(
                returncode=1 if include_session_id else 0,
                stdout=(
                    "No codex sessions found"
                    if include_session_id
                    else '{"results":[{"action":"created"}]}'
                ),
                stderr="",
            )
            return (not include_session_id), proc

        with mock.patch.object(self.module, "_nmem_command", return_value="/usr/local/bin/nmem"), \
             mock.patch.object(self.module, "_run_save_with_retries", side_effect=fake_run), \
             mock.patch.object(self.module.sys, "stdin", mock.Mock(read=lambda: json.dumps({"session_id": "full-uuid"}))):
            self.assertEqual(self.module.main(), 0)

        self.assertEqual(calls, [True, False])

    def test_run_save_retries_until_nmem_reports_saved_result(self):
        calls = [
            mock.Mock(returncode=0, stdout='{"results":[]}', stderr=""),
            mock.Mock(returncode=0, stdout='{"results":[{"action":"created"}]}', stderr=""),
        ]

        with mock.patch.object(self.module, "SAVE_RETRY_DELAYS_SECONDS", (0.0, 0.0)), \
             mock.patch.object(self.module, "_run_save", side_effect=calls) as run:
            captured, proc = self.module._run_save_with_retries(
                "/usr/local/bin/nmem",
                {"session_id": "019abc"},
                include_session_id=True,
            )

        self.assertTrue(captured)
        self.assertEqual(proc.stdout, '{"results":[{"action":"created"}]}')
        self.assertEqual(run.call_count, 2)

    def test_run_save_hides_child_console_on_windows(self):
        with mock.patch.object(self.module, "_build_save_command", return_value=["nmem.cmd", "--version"]), \
             mock.patch.object(self.module, "_build_env", return_value={}), \
             mock.patch.object(self.module.sys, "platform", "win32"), \
             mock.patch.object(self.module.subprocess, "run") as run:
            run.return_value = mock.Mock(returncode=0, stdout='{"results":[]}', stderr="")
            self.module._run_save(
                "nmem.cmd",
                {},
                include_session_id=True,
            )

        self.assertEqual(run.call_args.kwargs["creationflags"], 0x08000000)

    def test_run_save_does_not_pass_windows_creationflags_on_posix(self):
        with mock.patch.object(self.module, "_build_save_command", return_value=["nmem", "--version"]), \
             mock.patch.object(self.module, "_build_env", return_value={}), \
             mock.patch.object(self.module.sys, "platform", "linux"), \
             mock.patch.object(self.module.subprocess, "run") as run:
            run.return_value = mock.Mock(returncode=0, stdout='{"results":[]}', stderr="")
            self.module._run_save(
                "nmem",
                {},
                include_session_id=True,
            )

        self.assertNotIn("creationflags", run.call_args.kwargs)

    def test_run_save_falls_back_for_legacy_nmem_without_json_support(self):
        calls = [
            mock.Mock(returncode=2, stdout="", stderr="No such option: --json"),
            mock.Mock(returncode=0, stdout="", stderr=""),
        ]

        with mock.patch.object(self.module, "SAVE_RETRY_DELAYS_SECONDS", (0.0,)), \
             mock.patch.object(self.module, "_run_save", side_effect=calls) as run:
            captured, proc = self.module._run_save_with_retries(
                "/usr/local/bin/nmem",
                {"session_id": "019abc"},
                include_session_id=True,
            )

        self.assertTrue(captured)
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(run.call_count, 2)
        self.assertTrue(run.call_args_list[0].kwargs["json_output"])
        self.assertFalse(run.call_args_list[1].kwargs["json_output"])

    def test_extract_skill_outcomes_from_mcp_tool_call_end(self):
        transcript = self.temp_path / "codex-transcript.jsonl"
        transcript.write_text(
            json.dumps(
                {
                    "type": "mcp_tool_call_end",
                    "server": "nowledge-mem",
                    "tool": "find_skills",
                    "result": {
                        "matches": [
                            {
                                "skill_id": "skill-alpha",
                                "version": 3,
                                "name": "Alpha",
                            }
                        ]
                    },
                }
            )
            + "\n",
            encoding="utf-8",
        )

        self.assertEqual(
            self.module.extract_skill_outcomes_from_file(str(transcript)),
            [("skill-alpha", "3")],
        )

    def test_extract_skill_outcomes_defaults_missing_version_to_v1(self):
        transcript = self.temp_path / "codex-transcript-v1.jsonl"
        transcript.write_text(
            json.dumps(
                {
                    "type": "mcp_tool_call_end",
                    "server": "nowledge-mem",
                    "tool": "find_skills",
                    "result": {
                        "matches": [
                            {
                                "id": "skill-alpha",
                                "name": "Alpha",
                                "title": "Alpha Skill",
                                "description": "A managed skill",
                            }
                        ]
                    },
                }
            )
            + "\n",
            encoding="utf-8",
        )

        self.assertEqual(
            self.module.extract_skill_outcomes_from_file(str(transcript)),
            [("skill-alpha", "1")],
        )

    def test_extract_skill_outcomes_ignores_non_skill_style_ids(self):
        transcript = self.temp_path / "codex-transcript-non-skill-id.jsonl"
        transcript.write_text(
            json.dumps(
                {
                    "type": "mcp_tool_call_end",
                    "server": "nowledge-mem",
                    "tool": "find_skills",
                    "result": {
                        "matches": [
                            {
                                "skill_id": "alpha",
                                "version": "3",
                                "name": "Alpha",
                            }
                        ]
                    },
                }
            )
            + "\n",
            encoding="utf-8",
        )

        self.assertEqual(
            self.module.extract_skill_outcomes_from_file(str(transcript)),
            [],
        )

    def test_report_skill_outcomes_runs_once_per_transcript_skill_version(self):
        transcript = self.temp_path / "codex-transcript.jsonl"
        transcript.write_text(
            json.dumps(
                {
                    "type": "mcp_tool_call_end",
                    "server": "nowledge-mem",
                    "tool": "find_skills",
                    "result": {
                        "matches": [
                            {
                                "skill_id": "skill-alpha",
                                "version": "3",
                                "name": "Alpha",
                            }
                        ]
                    },
                }
            )
            + "\n",
            encoding="utf-8",
        )
        payload = {
            "session_id": "019abc",
            "cwd": str(self.temp_path),
            "transcript_path": str(transcript),
        }
        proc = mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(self.module.subprocess, "run", return_value=proc) as run:
            self.module._report_skill_outcomes("/usr/local/bin/nmem", payload)
            self.module._report_skill_outcomes("/usr/local/bin/nmem", payload)

        self.assertEqual(run.call_count, 1)
        command = run.call_args.args[0]
        self.assertEqual(
            command,
            [
                "/usr/local/bin/nmem",
                "skills",
                "outcome",
                "skill-alpha",
                "--version",
                "3",
                "--outcome",
                "completed",
            ],
        )

    def test_derive_codex_home_from_transcript_path(self):
        transcript = self.temp_path / "sessions" / "2026" / "05" / "02" / "rollout-abc.jsonl"
        transcript.parent.mkdir(parents=True)
        transcript.write_text("", encoding="utf-8")

        self.assertEqual(self.module._derive_codex_home(str(transcript)), self.temp_path)

    def _write_session_meta(self, originator: str) -> Path:
        transcript = self.temp_path / "sessions" / f"{originator}.jsonl"
        transcript.parent.mkdir(parents=True, exist_ok=True)
        transcript.write_text(
            json.dumps(
                {
                    "type": "session_meta",
                    "payload": {"id": "session-1", "originator": originator},
                }
            )
            + "\n",
            encoding="utf-8",
        )
        return transcript

    def test_delegated_conversation_originator_is_session_scoped(self):
        for originator in ("slock-daemon", "raft-daemon"):
            transcript = self._write_session_meta(originator)
            self.assertEqual(
                self.module._delegated_conversation_originator(
                    {"transcript_path": str(transcript)}
                ),
                originator,
            )

        for originator in ("codex_sdk_ts", "codex_exec", "codex_cli_rs"):
            transcript = self._write_session_meta(originator)
            self.assertIsNone(
                self.module._delegated_conversation_originator(
                    {"transcript_path": str(transcript)}
                )
            )

    def test_main_skips_only_delegated_thread_capture_but_reports_skills(self):
        transcript = self._write_session_meta("slock-daemon")
        hook_payload = json.dumps(
            {
                "session_id": "session-1",
                "transcript_path": str(transcript),
            }
        )

        with mock.patch.object(self.module, "_nmem_command", return_value="nmem"), \
             mock.patch.object(self.module, "_claim_capture_event", return_value=True), \
             mock.patch.object(self.module, "_run_save_with_retries") as save, \
             mock.patch.object(self.module, "_report_skill_outcomes") as report, \
             mock.patch.object(self.module.sys, "stdin", mock.Mock(read=lambda: hook_payload)):
            self.assertEqual(self.module.main(), 0)

        save.assert_not_called()
        report.assert_called_once()

    def test_claim_capture_event_suppresses_duplicate_same_transcript_state(self):
        transcript = self.temp_path / "sessions" / "2026" / "05" / "02" / "rollout-abc.jsonl"
        transcript.parent.mkdir(parents=True)
        transcript.write_text("first", encoding="utf-8")
        payload = {
            "session_id": "019abc",
            "cwd": str(self.temp_path / "project"),
            "transcript_path": str(transcript),
        }

        self.assertTrue(self.module._claim_capture_event(payload))
        self.assertFalse(self.module._claim_capture_event(payload))

    def test_claim_capture_event_allows_changed_transcript_state(self):
        transcript = self.temp_path / "sessions" / "2026" / "05" / "02" / "rollout-abc.jsonl"
        transcript.parent.mkdir(parents=True)
        transcript.write_text("first", encoding="utf-8")
        payload = {
            "session_id": "019abc",
            "cwd": str(self.temp_path / "project"),
            "transcript_path": str(transcript),
        }

        self.assertTrue(self.module._claim_capture_event(payload))
        transcript.write_text("first\nsecond", encoding="utf-8")
        self.assertTrue(self.module._claim_capture_event(payload))

    def test_missing_nmem_is_non_fatal(self):
        with mock.patch.object(self.module, "_nmem_command", return_value=None), \
             mock.patch.object(self.module.sys, "stdin", mock.Mock(read=lambda: "{}")):
            self.assertEqual(self.module.main(), 0)

    def test_hook_response_is_valid_stop_hook_json(self):
        stdout = io.StringIO()

        with mock.patch.object(self.module.sys, "stdout", stdout):
            self.module._write_hook_response()

        self.assertEqual(
            json.loads(stdout.getvalue()),
            {"continue": True, "suppressOutput": True},
        )
        self.assertTrue(stdout.getvalue().endswith("\n"))

    def test_hook_entrypoint_emits_valid_stop_hook_json(self):
        env = os.environ.copy()
        env["CODEX_HOME"] = str(self.temp_path / ".codex")
        env["PATH"] = ""

        proc = subprocess.run(
            [sys.executable, str(HOOK_MODULE_PATH), "--event", "stop"],
            input="{}",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            check=False,
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(
            json.loads(proc.stdout),
            {"continue": True, "suppressOutput": True},
        )

    def test_hook_entrypoint_emits_response_when_main_exits_early(self):
        stdout = io.StringIO()

        with mock.patch.object(self.module, "main", side_effect=SystemExit(7)), \
             mock.patch.object(self.module.sys, "stdout", stdout):
            self.assertEqual(self.module._run_entrypoint(), 7)

        self.assertEqual(
            json.loads(stdout.getvalue()),
            {"continue": True, "suppressOutput": True},
        )


class PackagedHookConfigTests(unittest.TestCase):
    def test_packaged_hooks_json_uses_strict_codex_schema(self):
        payload = json.loads(HOOKS_JSON_PATH.read_text(encoding="utf-8"))

        self.assertEqual(set(payload.keys()), {"hooks"})

    def test_packaged_stop_hook_prefers_stable_installed_runtime(self):
        payload = json.loads(HOOKS_JSON_PATH.read_text(encoding="utf-8"))
        hook = payload["hooks"]["Stop"][0]["hooks"][0]

        self.assertIn("os.environ['PLUGIN_ROOT']", hook["command"])
        self.assertIn("nmem-stop-launch.py", hook["command"])
        self.assertIn('python3 -c "import os, runpy, sys', hook["command"])
        self.assertIn('python -c "import os, runpy, sys', hook["command"])
        self.assertNotIn("${PLUGIN_ROOT}", hook["command"])
        self.assertNotIn("%PLUGIN_ROOT%", hook["command"])
        self.assertNotIn("if [", hook["command"])
        self.assertNotIn("$HOME/.codex/hooks/nowledge-mem-stop-save.py", hook["command"])
        self.assertIn("os.environ['PLUGIN_ROOT']", hook["commandWindows"])
        self.assertIn("nmem-stop-launch.py", hook["commandWindows"])
        self.assertNotIn("${PLUGIN_ROOT}", hook["commandWindows"])
        self.assertNotIn("%PLUGIN_ROOT%", hook["commandWindows"])

    def test_packaged_context_hooks_use_strict_cross_platform_launchers(self):
        hooks = json.loads(HOOKS_JSON_PATH.read_text(encoding="utf-8"))["hooks"]

        self.assertEqual(
            set(hooks), {"SessionStart", "UserPromptSubmit", "Stop"}
        )
        self.assertEqual(hooks["SessionStart"][0]["matcher"], "startup|resume|clear|compact")
        for event_name in ("SessionStart", "UserPromptSubmit"):
            hook = hooks[event_name][0]["hooks"][0]
            self.assertIn("os.environ['PLUGIN_ROOT']", hook["command"])
            self.assertIn("nmem-context.py", hook["command"])
            self.assertIn("nmem-context.py", hook["commandWindows"])
            self.assertNotIn("${PLUGIN_ROOT}", hook["command"])
            self.assertNotIn("%PLUGIN_ROOT%", hook["commandWindows"])
            self.assertTrue(hook["commandWindows"].startswith("py -3 -c "))

        session_timeout = hooks["SessionStart"][0]["hooks"][0]["timeout"]
        context_module = load_module("nmem_context_timeout", CONTEXT_MODULE_PATH)
        self.assertGreater(
            session_timeout,
            context_module.CONTEXT_TOTAL_TIMEOUT_SECONDS,
        )


class ContextHookTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module("nmem_context", CONTEXT_MODULE_PATH)

    def test_session_start_injects_routing_and_context_bundle(self):
        stdout = io.StringIO()
        with mock.patch.object(
            self.module, "_load_startup_context", return_value="# Bundle\nCurrent work"
        ), mock.patch.object(self.module.sys, "stdout", stdout):
            self.assertEqual(
                self.module.main({"hook_event_name": "SessionStart"}), 0
            )

        response = json.loads(stdout.getvalue())
        output = response["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "SessionStart")
        self.assertIn("Nowledge Mem routing", output["additionalContext"])
        self.assertIn("# Bundle", output["additionalContext"])

    def test_user_prompt_injects_routing_without_reloading_context(self):
        stdout = io.StringIO()
        with mock.patch.object(self.module, "_load_startup_context") as load, \
             mock.patch.object(self.module.sys, "stdout", stdout):
            self.assertEqual(
                self.module.main({"hook_event_name": "UserPromptSubmit"}), 0
            )

        load.assert_not_called()
        output = json.loads(stdout.getvalue())["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "UserPromptSubmit")
        self.assertIn("Codex local Memory", output["additionalContext"])
        self.assertNotIn("Current Nowledge context", output["additionalContext"])

    def test_session_output_is_ascii_safe_for_windows_codepages(self):
        stdout = io.StringIO()
        with mock.patch.object(
            self.module, "_load_startup_context", return_value="中文上下文"
        ), mock.patch.object(self.module.sys, "stdout", stdout):
            self.assertEqual(
                self.module.main({"hook_event_name": "SessionStart"}), 0
            )

        encoded = stdout.getvalue()
        self.assertTrue(encoded.isascii())
        self.assertIn("中文上下文", json.loads(encoded)["hookSpecificOutput"]["additionalContext"])

    def test_context_command_uses_shared_cmd_bridge_and_utf8(self):
        with mock.patch.object(
            self.module,
            "_build_nmem_command",
            return_value=["cmd.exe", "/d", "/s", "/c", "nmem.cmd --json context"],
        ) as build, mock.patch.object(self.module.subprocess, "run") as run:
            run.return_value = mock.Mock(
                returncode=0,
                stdout='{"rendered_markdown":"ok"}',
                stderr="",
            )
            payload = self.module._run_nmem_json(
                "nmem.cmd",
                ["context"],
                timeout_seconds=3.0,
            )

        self.assertEqual(payload, {"rendered_markdown": "ok"})
        build.assert_called_once_with("nmem.cmd", "--json", "context")
        self.assertEqual(run.call_args.kwargs["encoding"], "utf-8")
        self.assertEqual(run.call_args.kwargs["errors"], "replace")

    def test_context_args_preserve_explicit_identity_and_space(self):
        with mock.patch.dict(
            self.module.os.environ,
            {
                "NMEM_AGENT_ID": "reviewer",
                "NMEM_HOST_AGENT_ID": "raft-worker",
                "NMEM_SPACE": "release",
            },
            clear=False,
        ):
            self.assertEqual(
                self.module._context_args(),
                [
                    "context",
                    "--source-app",
                    "codex",
                    "--agent-id",
                    "reviewer",
                    "--host-agent-id",
                    "raft-worker",
                    "--space",
                    "release",
                ],
            )


class RuntimeHelperTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module("nmem_runtime_test", RUNTIME_MODULE_PATH)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_wsl_cmd_shim_uses_cmd_bridge_and_windows_path(self):
        nmem = "/mnt/c/Users/test/AppData/Local/Nowledge Mem/cli/nmem.cmd"
        with mock.patch.object(self.module.os, "name", "posix"):
            command = self.module.build_nmem_command(nmem, "--json", "context")

        self.assertEqual(command[:4], ["cmd.exe", "/d", "/s", "/c"])
        self.assertIn(r"C:\Users\test\AppData\Local\Nowledge Mem\cli\nmem.cmd", command[4])

    def test_native_windows_batch_shim_executes_directly(self):
        metacharacters = "safe&pipe|percent%caret^bang!"
        with mock.patch.object(self.module.os, "name", "nt"):
            command = self.module.build_nmem_command(
                r"C:\Program Files\Nowledge Mem\nmem.bat",
                "--json",
                "context",
                metacharacters,
            )

        self.assertEqual(
            command,
            [
                r"C:\Program Files\Nowledge Mem\nmem.bat",
                "--json",
                "context",
                metacharacters,
            ],
        )

    def test_explicit_cli_path_wins_when_shell_path_is_empty(self):
        nmem = self.temp_path / "custom" / "nmem"
        nmem.parent.mkdir()
        nmem.write_text("#!/bin/sh\n", encoding="utf-8")
        nmem.chmod(0o755)

        with mock.patch.dict(
            self.module.os.environ,
            {"NMEM_CLI_PATH": str(nmem), "PATH": ""},
            clear=False,
        ), mock.patch.object(self.module.shutil, "which", return_value=None):
            self.assertEqual(self.module.find_nmem_command(), str(nmem))

    def test_desktop_wrapper_is_found_when_shell_path_is_empty(self):
        nmem = (
            self.temp_path
            / ".local"
            / "share"
            / "nowledge-mem"
            / "bin"
            / "nmem-wrapper"
        )
        nmem.parent.mkdir(parents=True)
        nmem.write_text("#!/bin/sh\n", encoding="utf-8")
        nmem.chmod(0o755)

        with mock.patch.dict(
            self.module.os.environ,
            {"NMEM_CLI_PATH": "", "PATH": "", "LOCALAPPDATA": "", "APPDATA": ""},
            clear=False,
        ), mock.patch.object(self.module.shutil, "which", return_value=None), \
             mock.patch.object(self.module.Path, "home", return_value=self.temp_path), \
             mock.patch.object(self.module, "_wsl_windows_local_app_data", return_value=None):
            self.assertEqual(self.module.find_nmem_command(), str(nmem))

    def test_canonical_windows_desktop_shim_is_found_outside_path(self):
        local_app_data = self.temp_path / "Local"
        nmem = local_app_data / "Nowledge Mem CLI" / "bin" / "nmem.cmd"
        nmem.parent.mkdir(parents=True)
        nmem.write_text("@echo off\r\n", encoding="utf-8")

        with mock.patch.dict(
            self.module.os.environ,
            {
                "NMEM_CLI_PATH": "",
                "PATH": "",
                "LOCALAPPDATA": str(local_app_data),
                "APPDATA": "",
            },
            clear=False,
        ), mock.patch.object(self.module.shutil, "which", return_value=None), \
             mock.patch.object(self.module.Path, "home", return_value=self.temp_path), \
             mock.patch.object(self.module, "_wsl_windows_local_app_data", return_value=None):
            self.assertIn(nmem, self.module._known_nmem_candidates())
            with mock.patch.object(
                self.module, "_known_nmem_candidates", return_value=[nmem]
            ):
                self.assertEqual(self.module.find_nmem_command(), str(nmem))

    def test_legacy_program_files_desktop_shim_is_a_stable_candidate(self):
        program_files = self.temp_path / "Program Files"
        nmem = program_files / "Nowledge Mem" / "cli" / "nmem.cmd"
        nmem.parent.mkdir(parents=True)
        nmem.write_text("@echo off\r\n", encoding="utf-8")

        with mock.patch.dict(
            self.module.os.environ,
            {
                "LOCALAPPDATA": "",
                "APPDATA": "",
                "PROGRAMFILES": str(program_files),
                "PROGRAMW6432": "",
                "PROGRAMFILES(X86)": "",
            },
            clear=False,
        ), mock.patch.object(self.module.Path, "home", return_value=self.temp_path), \
             mock.patch.object(self.module, "_wsl_windows_local_app_data", return_value=None):
            self.assertIn(nmem, self.module._known_nmem_candidates())


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module("nmem_stop_launch", LAUNCH_MODULE_PATH)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_launcher_prefers_stable_host_hook(self):
        codex_home = self.temp_path / ".codex"
        stable_hook = codex_home / "hooks" / "nowledge-mem-stop-save.py"
        stable_hook.parent.mkdir(parents=True)
        stable_hook.write_text("# stable", encoding="utf-8")
        calls = []

        def fake_run_path(path, *, run_name):
            calls.append((Path(path), run_name, list(self.module.sys.argv)))
            return {}

        with mock.patch.dict(self.module.os.environ, {"CODEX_HOME": str(codex_home)}, clear=False), \
             mock.patch.object(self.module.runpy, "run_path", side_effect=fake_run_path), \
             mock.patch.object(self.module.sys, "argv", ["launcher", "--event", "stop"]):
            self.assertEqual(self.module.main(), 0)

        self.assertEqual(calls, [(stable_hook, "__main__", [str(stable_hook), "--event", "stop"])])

    def test_launcher_falls_back_to_packaged_hook(self):
        missing_hook = self.temp_path / "missing.py"
        packaged_hook = self.temp_path / "nmem-stop-save.py"
        calls = []

        def fake_run_path(path, *, run_name):
            calls.append((Path(path), run_name, list(self.module.sys.argv)))
            return {}

        with mock.patch.object(self.module, "_stable_host_hook", return_value=missing_hook), \
             mock.patch.object(self.module, "_packaged_hook", return_value=packaged_hook), \
             mock.patch.object(self.module.runpy, "run_path", side_effect=fake_run_path), \
             mock.patch.object(self.module.sys, "argv", ["launcher", "--event", "stop"]):
            self.assertEqual(self.module.main(), 0)

        self.assertEqual(calls, [(packaged_hook, "__main__", [str(packaged_hook), "--event", "stop"])])

    def test_launcher_entrypoint_emits_valid_stop_hook_json(self):
        codex_home = self.temp_path / ".codex"
        env = os.environ.copy()
        env["CODEX_HOME"] = str(codex_home)
        env["PATH"] = ""

        proc = subprocess.run(
            [sys.executable, str(LAUNCH_MODULE_PATH), "--event", "stop"],
            input="{}",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            check=False,
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(
            json.loads(proc.stdout),
            {"continue": True, "suppressOutput": True},
        )


class InstallHookTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module("install_hooks", INSTALL_MODULE_PATH)
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)
        self.module.CODEX_DIR = self.temp_path / ".codex"
        self.module.HOOKS_DIR = self.module.CODEX_DIR / "hooks"
        self.module.GLOBAL_HOOKS_FILE = self.module.CODEX_DIR / "hooks.json"
        self.module.CONFIG_FILE = self.module.CODEX_DIR / "config.toml"
        self.module.INSTALLED_HOOK = self.module.HOOKS_DIR / "nowledge-mem-stop-save.py"
        self.module.INSTALLED_SKILL_OUTCOME = self.module.HOOKS_DIR / "skill_outcome.py"
        self.module.INSTALLED_NMEM_RUNTIME = self.module.HOOKS_DIR / "nmem_runtime.py"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_load_json_recovers_from_malformed_json(self):
        self.module.GLOBAL_HOOKS_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.GLOBAL_HOOKS_FILE.write_text("{not-json", encoding="utf-8")

        payload = self.module.load_json(self.module.GLOBAL_HOOKS_FILE)

        self.assertEqual(payload, {})
        backups = list(self.module.GLOBAL_HOOKS_FILE.parent.glob("hooks.json.*.bak"))
        self.assertEqual(len(backups), 1)

    def test_merge_hooks_json_preserves_other_stop_hooks_and_replaces_ours(self):
        self.module.GLOBAL_HOOKS_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.GLOBAL_HOOKS_FILE.write_text(
            json.dumps(
                {
                    "hooks": {
                        "Stop": [
                            {"hooks": [{"type": "command", "command": "echo keep"}]},
                            {"hooks": [{"type": "command", "command": "/old/nmem-stop-save.py"}]},
                        ]
                    }
                }
            ),
            encoding="utf-8",
        )

        self.module.merge_hooks_json()
        payload = self.module.load_json(self.module.GLOBAL_HOOKS_FILE)
        stop = payload["hooks"]["Stop"]

        self.assertEqual(len(stop), 2)
        self.assertIn("echo keep", stop[0]["hooks"][0]["command"])
        self.assertIn("nowledge-mem-stop-save.py", stop[1]["hooks"][0]["command"])
        self.assertNotIn("async", stop[1]["hooks"][0])
        self.assertEqual(stop[1]["hooks"][0]["timeout"], 40)
        self.assertIn("statusMessage", stop[1]["hooks"][0])
        self.assertNotIn("/old/nmem-stop-save.py", json.dumps(stop))

    def test_ensure_codex_hooks_enabled_only_changes_features_section(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    '[projects."/tmp/demo"]',
                    "codex_hooks = false",
                    "",
                    "[features]",
                    "apps = true",
                    "codex_hooks = false",
                    "",
                ]
            ),
            encoding="utf-8",
        )

        self.module.ensure_codex_hooks_enabled()
        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")

        self.assertIn('[projects."/tmp/demo"]\ncodex_hooks = false', updated)
        self.assertIn(
            "[features]\napps = true\ncodex_hooks = true\nhooks = true\nplugin_hooks = true",
            updated,
        )

    def test_ensure_codex_hooks_enabled_updates_plugin_hook_flag(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    "[features]",
                    "plugins = true",
                    "hooks = false",
                    "plugin_hooks = false",
                    "",
                ]
            ),
            encoding="utf-8",
        )

        self.module.ensure_codex_hooks_enabled()
        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")

        self.assertIn("[features]\nplugins = true\nhooks = true\nplugin_hooks = true", updated)

    def test_modern_codex_does_not_add_removed_plugin_hooks_flag(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "[features]\nplugins = true\nhooks = false\n",
            encoding="utf-8",
        )

        self.module.ensure_codex_hooks_enabled(plugin_hooks_required=False)
        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")

        self.assertIn("hooks = true", updated)
        self.assertNotIn("plugin_hooks", updated)

    def test_modern_codex_preserves_existing_removed_plugin_hooks_value(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "[features]\nhooks = false\nplugin_hooks = false\n",
            encoding="utf-8",
        )

        self.module.ensure_codex_hooks_enabled(plugin_hooks_required=False)
        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")

        self.assertIn("hooks = true", updated)
        self.assertIn("plugin_hooks = false", updated)

    def test_codex_feature_probe_distinguishes_removed_legacy_gate(self):
        removed = mock.Mock(
            returncode=0,
            stdout="hooks stable true\nplugin_hooks removed false\n",
            stderr="",
        )
        active = mock.Mock(
            returncode=0,
            stdout="hooks experimental true\nplugin_hooks experimental false\n",
            stderr="",
        )
        with mock.patch.object(self.module.shutil, "which", return_value="codex"), \
             mock.patch.object(self.module.subprocess, "run", return_value=removed):
            self.assertFalse(self.module.codex_requires_legacy_plugin_hooks_gate())
        with mock.patch.object(self.module.shutil, "which", return_value="codex"), \
             mock.patch.object(self.module.subprocess, "run", return_value=active):
            self.assertTrue(self.module.codex_requires_legacy_plugin_hooks_gate())

    def test_mcp_probe_uses_shared_cli_resolver_outside_path(self):
        proc = mock.Mock(returncode=0, stdout='{"toml":"ok"}', stderr="")
        command = [
            r"C:\Program Files\Nowledge Mem\cli\nmem.cmd",
            "--json",
            "config",
            "mcp",
            "show",
            "--host",
            "codex",
        ]
        with mock.patch.object(
            self.module,
            "_find_nmem_command",
            return_value=r"C:\Program Files\Nowledge Mem\cli\nmem.cmd",
        ), mock.patch.object(
            self.module, "_build_nmem_command", return_value=command
        ) as build, mock.patch.object(
            self.module, "_windows_no_window_kwargs", return_value={}
        ), mock.patch.object(
            self.module.subprocess, "run", return_value=proc
        ) as run:
            self.assertEqual(self.module._load_codex_mcp_payload(), {"toml": "ok"})

        build.assert_called_once_with(
            r"C:\Program Files\Nowledge Mem\cli\nmem.cmd",
            "--json",
            "config",
            "mcp",
            "show",
            "--host",
            "codex",
        )
        self.assertEqual(run.call_args.args[0], command)

    def test_ensure_codex_hooks_enabled_ignores_bracket_values_inside_features(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    "[features]",
                    "labels = [",
                    '  "[not a table header]"',
                    "]",
                    "plugins = true",
                    "",
                    "[plugins.\"nowledge-mem@nowledge-community\"]",
                    "enabled = true",
                    "",
                ]
            ),
            encoding="utf-8",
        )

        self.module.ensure_codex_hooks_enabled()
        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")

        self.assertIn(
            'labels = [\n  "[not a table header]"\n]\nplugins = true\nhooks = true\nplugin_hooks = true',
            updated,
        )
        self.assertIn('[plugins."nowledge-mem@nowledge-community"]\nenabled = true', updated)

    def test_ensure_codex_hooks_enabled_rejects_invalid_toml(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text("[features\ncodex_hooks = false\n", encoding="utf-8")

        with self.assertRaises(SystemExit):
            self.module.ensure_codex_hooks_enabled()

        self.assertEqual(
            self.module.CONFIG_FILE.read_text(encoding="utf-8"),
            "[features\ncodex_hooks = false\n",
        )

    def test_ensure_nowledge_plugin_hook_state_enables_packaged_stop_hook(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    "[features]",
                    "hooks = true",
                    "plugin_hooks = true",
                    "",
                    '[hooks.state."nowledge-mem@nowledge-community:hooks/hooks.json:stop:0:0"]',
                    "enabled = false",
                    'trusted_hash = "user-approved-command-hash"',
                    "",
                ]
            ),
            encoding="utf-8",
        )

        self.module.ensure_nowledge_plugin_hook_state_enabled()
        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")

        self.assertIn(
            '[hooks.state."nowledge-mem@nowledge-community:hooks/hooks.json:stop:0:0"]\n'
            'enabled = true\ntrusted_hash = "user-approved-command-hash"',
            updated,
        )
        self.assertIn(
            '[hooks.state."nowledge-mem@local:hooks/hooks.json:stop:0:0"]\n'
            "enabled = true",
            updated,
        )
        for event_name in ("session_start", "user_prompt_submit"):
            self.assertIn(
                f'[hooks.state."nowledge-mem@nowledge-community:hooks/hooks.json:{event_name}:0:0"]\n'
                "enabled = true",
                updated,
            )
            self.assertIn(
                f'[hooks.state."nowledge-mem@local:hooks/hooks.json:{event_name}:0:0"]\n'
                "enabled = true",
                updated,
            )

        self.module.ensure_nowledge_plugin_hook_state_enabled()
        rerun = self.module.CONFIG_FILE.read_text(encoding="utf-8")
        self.assertEqual(rerun.count("nowledge-mem@nowledge-community:hooks/hooks.json:stop:0:0"), 1)
        self.assertEqual(rerun.count("nowledge-mem@local:hooks/hooks.json:stop:0:0"), 1)
        self.assertEqual(rerun.count("trusted_hash"), 1)

    def test_memory_coexistence_guidance_warns_without_mutating_config(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        original = "[features]\nmemories = true\n\n[memories]\ngenerate_memories = true\n"
        self.module.CONFIG_FILE.write_text(original, encoding="utf-8")
        stderr = io.StringIO()

        with mock.patch.object(self.module.sys, "stderr", stderr):
            self.module.print_codex_memory_coexistence_guidance()

        self.assertIn("Allow memory generation from tool-assisted tasks", stderr.getvalue())
        self.assertEqual(self.module.CONFIG_FILE.read_text(encoding="utf-8"), original)

    def test_memory_coexistence_guidance_accepts_external_context_isolation(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "[features]\nmemories = true\n\n[memories]\ndisable_on_external_context = true\n",
            encoding="utf-8",
        )
        stderr = io.StringIO()

        with mock.patch.object(self.module.sys, "stderr", stderr):
            self.module.print_codex_memory_coexistence_guidance()

        self.assertEqual(stderr.getvalue(), "")

    def test_memory_coexistence_guidance_skips_when_generation_is_disabled(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "[features]\nmemories = true\n\n[memories]\ngenerate_memories = false\n",
            encoding="utf-8",
        )
        stderr = io.StringIO()

        with mock.patch.object(self.module.sys, "stderr", stderr):
            self.module.print_codex_memory_coexistence_guidance()

        self.assertEqual(stderr.getvalue(), "")

    def test_install_runtime_hook_copies_runtime(self):
        self.module.install_runtime_hook()

        self.assertTrue(self.module.INSTALLED_HOOK.exists())
        self.assertIn("Best-effort Codex transcript capture", self.module.INSTALLED_HOOK.read_text())
        self.assertTrue(self.module.INSTALLED_SKILL_OUTCOME.exists())
        self.assertIn(
            "extract_skill_outcomes_from_file",
            self.module.INSTALLED_SKILL_OUTCOME.read_text(),
        )
        self.assertTrue(self.module.INSTALLED_NMEM_RUNTIME.exists())
        self.assertIn(
            "def build_nmem_command",
            self.module.INSTALLED_NMEM_RUNTIME.read_text(),
        )

    def test_install_runtime_hook_fails_when_skill_outcome_extractor_missing(self):
        self.module.SOURCE_SKILL_OUTCOME = self.temp_path / "missing-skill-outcome.py"

        with self.assertRaises(SystemExit) as raised:
            self.module.install_runtime_hook()

        self.assertIn("missing skill outcome extractor", str(raised.exception))
        self.assertFalse(self.module.INSTALLED_SKILL_OUTCOME.exists())

    def test_install_codex_mcp_config_writes_managed_authenticated_override(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text("[features]\nhooks = true\n", encoding="utf-8")
        self.module.CONFIG_FILE.chmod(0o644)
        payload = {
            "apiKeyConfigured": True,
            "warnings": [],
            "rendered": "\n".join(
                [
                    "[mcp_servers.nowledge-mem]",
                    'url = "http://127.0.0.1:14242/mcp/"',
                    "",
                    "[mcp_servers.nowledge-mem.http_headers]",
                    'APP = "Codex"',
                    'Authorization = "Bearer nmem_test"',
                    '"X-NMEM-API-Key" = "nmem_test"',
                ]
            ),
        }

        with mock.patch.object(self.module, "_load_codex_mcp_payload", return_value=payload):
            self.assertTrue(self.module.install_codex_mcp_config())

        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")
        self.assertIn("[features]\nhooks = true", updated)
        self.assertIn(self.module.MCP_MANAGED_BEGIN, updated)
        self.assertIn('Authorization = "Bearer nmem_test"', updated)
        self.assertIn(self.module.MCP_MANAGED_END, updated)
        if os.name != "nt":
            self.assertEqual(self.module.CONFIG_FILE.stat().st_mode & 0o777, 0o600)

    def test_install_codex_mcp_config_preserves_user_owned_mcp_override(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    "[mcp_servers.nowledge-mem]",
                    'url = "https://user.example/mcp/"',
                    "",
                ]
            ),
            encoding="utf-8",
        )
        payload = {
            "apiKeyConfigured": True,
            "warnings": [],
            "rendered": "\n".join(
                [
                    "[mcp_servers.nowledge-mem]",
                    'url = "http://127.0.0.1:14242/mcp/"',
                    "",
                    "[mcp_servers.nowledge-mem.http_headers]",
                    'APP = "Codex"',
                    'Authorization = "Bearer nmem_test"',
                ]
            ),
        }

        with mock.patch.object(self.module, "_load_codex_mcp_payload", return_value=payload):
            self.assertFalse(self.module.install_codex_mcp_config())

        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")
        self.assertIn('url = "https://user.example/mcp/"', updated)
        self.assertNotIn(self.module.MCP_MANAGED_BEGIN, updated)

    def test_install_codex_mcp_config_preserves_quoted_user_owned_mcp_override(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    '[mcp_servers . "nowledge-mem"]',
                    'url = "https://user.example/mcp/"',
                    "",
                    '[mcp_servers . "nowledge-mem" . http_headers]',
                    'APP = "Codex"',
                    "",
                ]
            ),
            encoding="utf-8",
        )
        payload = {
            "apiKeyConfigured": True,
            "warnings": [],
            "rendered": "\n".join(
                [
                    "[mcp_servers.nowledge-mem]",
                    'url = "http://127.0.0.1:14242/mcp/"',
                    "",
                    "[mcp_servers.nowledge-mem.http_headers]",
                    'Authorization = "Bearer nmem_test"',
                ]
            ),
        }

        with mock.patch.object(self.module, "_load_codex_mcp_payload", return_value=payload):
            self.assertFalse(self.module.install_codex_mcp_config())

        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")
        self.assertIn('[mcp_servers . "nowledge-mem"]', updated)
        self.assertNotIn(self.module.MCP_MANAGED_BEGIN, updated)
        self.assertNotIn("nmem_test", updated)

    def test_install_codex_mcp_config_preserves_fully_quoted_user_owned_mcp_override(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    '["mcp_servers"."nowledge-mem"]',
                    'url = "https://user.example/mcp/"',
                    "",
                    '["mcp_servers"."nowledge-mem".http_headers]',
                    'APP = "Codex"',
                    "",
                ]
            ),
            encoding="utf-8",
        )
        payload = {
            "apiKeyConfigured": True,
            "warnings": [],
            "rendered": "\n".join(
                [
                    "[mcp_servers.nowledge-mem]",
                    'url = "http://127.0.0.1:14242/mcp/"',
                    "",
                    "[mcp_servers.nowledge-mem.http_headers]",
                    'Authorization = "Bearer nmem_test"',
                ]
            ),
        }

        with mock.patch.object(self.module, "_load_codex_mcp_payload", return_value=payload):
            self.assertFalse(self.module.install_codex_mcp_config())

        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")
        self.assertIn('["mcp_servers"."nowledge-mem"]', updated)
        self.assertNotIn(self.module.MCP_MANAGED_BEGIN, updated)
        self.assertNotIn("nmem_test", updated)

    def test_install_codex_mcp_config_writes_identity_aware_local_override(self):
        payload = {
            "apiKeyConfigured": False,
            "endpoint": "http://127.0.0.1:14242/mcp/",
            "warnings": [],
            "rendered": "\n".join(
                [
                    "[mcp_servers.nowledge-mem]",
                    'url = "http://127.0.0.1:14242/mcp/"',
                    'env_http_headers = { "X-Nmem-Agent-Id" = "NMEM_AGENT_ID" }',
                    "",
                    "[mcp_servers.nowledge-mem.http_headers]",
                    'APP = "Codex"',
                ]
            ),
        }

        with mock.patch.object(self.module, "_load_codex_mcp_payload", return_value=payload):
            self.assertTrue(self.module.install_codex_mcp_config())

        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")
        self.assertIn(self.module.MCP_MANAGED_BEGIN, updated)
        self.assertIn('"X-Nmem-Agent-Id" = "NMEM_AGENT_ID"', updated)

    def test_install_codex_mcp_config_replaces_stale_managed_override(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    "[features]",
                    "hooks = true",
                    "",
                    self.module.MCP_MANAGED_BEGIN,
                    "[mcp_servers.nowledge-mem]",
                    'url = "https://old.example/mcp/"',
                    "",
                    "[mcp_servers.nowledge-mem.http_headers]",
                    'Authorization = "Bearer old_key"',
                    self.module.MCP_MANAGED_END,
                    "",
                ]
            ),
            encoding="utf-8",
        )
        payload = {
            "apiKeyConfigured": False,
            "endpoint": "http://127.0.0.1:14242/mcp/",
            "warnings": [],
            "rendered": "\n".join(
                [
                    "[mcp_servers.nowledge-mem]",
                    'url = "http://127.0.0.1:14242/mcp/"',
                    'env_http_headers = { "X-Nmem-Agent-Id" = "NMEM_AGENT_ID" }',
                    "",
                    "[mcp_servers.nowledge-mem.http_headers]",
                    'APP = "Codex"',
                ]
            ),
        }

        with mock.patch.object(self.module, "_load_codex_mcp_payload", return_value=payload):
            self.assertTrue(self.module.install_codex_mcp_config())

        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")
        self.assertIn("[features]\nhooks = true", updated)
        self.assertIn(self.module.MCP_MANAGED_BEGIN, updated)
        self.assertIn('"X-Nmem-Agent-Id" = "NMEM_AGENT_ID"', updated)
        self.assertNotIn("old_key", updated)

    def test_install_codex_mcp_config_preserves_unterminated_managed_block(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        original = "\n".join(
            [
                "[features]",
                "hooks = true",
                "",
                self.module.MCP_MANAGED_BEGIN,
                "[mcp_servers.nowledge-mem]",
                'url = "https://old.example/mcp/"',
                "",
                '[projects."/tmp/demo"]',
                "trusted = true",
                "",
            ]
        )
        self.module.CONFIG_FILE.write_text(original, encoding="utf-8")
        payload = {
            "apiKeyConfigured": True,
            "warnings": [],
            "rendered": "\n".join(
                [
                    "[mcp_servers.nowledge-mem]",
                    'url = "http://127.0.0.1:14242/mcp/"',
                    "",
                    "[mcp_servers.nowledge-mem.http_headers]",
                    'Authorization = "Bearer nmem_test"',
                ]
            ),
        }

        with mock.patch.object(self.module, "_load_codex_mcp_payload", return_value=payload):
            self.assertFalse(self.module.install_codex_mcp_config())

        self.assertEqual(self.module.CONFIG_FILE.read_text(encoding="utf-8"), original)


if __name__ == "__main__":
    unittest.main()
