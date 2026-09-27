import importlib.util
import io
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOOK_PATH = PLUGIN_ROOT / "hooks" / "nmem-capture.py"


def load_hook():
    spec = importlib.util.spec_from_file_location("dimagent_capture", HOOK_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class DimAgentCaptureTests(unittest.TestCase):
    def setUp(self):
        self.module = load_hook()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.module._log_path = lambda: Path(self.temp_dir.name) / "capture.log"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_regular_events_use_session_id(self):
        for event in ("Stop", "PreCompact"):
            with self.subTest(event=event):
                self.assertEqual(
                    self.module._capture_id(
                        {"hook_event_name": event, "session_id": "session-1"}
                    ),
                    "session-1",
                )

    def test_subagent_stop_uses_agent_id(self):
        self.assertEqual(
            self.module._capture_id(
                {
                    "hook_event_name": "SubagentStop",
                    "session_id": "parent",
                    "agent_id": "child-1",
                }
            ),
            "child-1",
        )

    def test_capture_only_accepts_enqueued_acknowledgement(self):
        completed = subprocess.CompletedProcess([], 0, '{"status":"enqueued"}', "")
        with (
            mock.patch.object(
                self.module, "find_nmem_command", return_value="/usr/local/bin/nmem"
            ),
            mock.patch.object(
                self.module.subprocess, "run", return_value=completed
            ) as run,
        ):
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})

        self.assertEqual(
            run.call_args.args[0],
            [
                "/usr/local/bin/nmem",
                "--json",
                "t",
                "capture",
                "--from",
                "dimagent",
                "--session-id",
                "session-1",
            ],
        )
        self.assertFalse((Path(self.temp_dir.name) / "capture.log").exists())

    def test_missing_child_id_never_falls_back_to_parent_capture(self):
        for child in (None, "", "  ", 123):
            with (
                self.subTest(child=child),
                mock.patch.object(self.module, "find_nmem_command") as resolve,
            ):
                self.module._capture(
                    {
                        "hook_event_name": "SubagentStop",
                        "session_id": "parent",
                        "agent_id": child,
                    }
                )
                resolve.assert_not_called()

    def test_capture_failure_is_bounded_content_free_and_fail_open(self):
        for failure in (
            OSError("synthetic-secret"),
            subprocess.TimeoutExpired("nmem", 8),
        ):
            with (
                self.subTest(failure=type(failure).__name__),
                mock.patch.object(
                    self.module, "find_nmem_command", return_value="nmem"
                ),
                mock.patch.object(
                    self.module.subprocess, "run", side_effect=failure
                ) as run,
            ):
                self.module._capture(
                    {"hook_event_name": "Stop", "session_id": "session-1"}
                )
                self.assertEqual(run.call_args.kwargs["timeout"], 8)
        log = (Path(self.temp_dir.name) / "capture.log").read_text(encoding="utf-8")
        self.assertIn("invocation failed", log)
        self.assertNotIn("synthetic-secret", log)

    def test_nonzero_exit_or_malformed_ack_is_not_success(self):
        for status, stdout in (
            (1, '{"status":"enqueued"}'),
            (0, "not json"),
            (0, "[]"),
            (0, "null"),
        ):
            with (
                self.subTest(status=status, stdout=stdout),
                mock.patch.object(
                    self.module, "find_nmem_command", return_value="nmem"
                ),
                mock.patch.object(
                    self.module.subprocess,
                    "run",
                    return_value=subprocess.CompletedProcess(
                        [], status, stdout, "synthetic-secret"
                    ),
                ),
            ):
                self.module._capture(
                    {"hook_event_name": "Stop", "session_id": "session-1"}
                )
        log = (Path(self.temp_dir.name) / "capture.log").read_text(encoding="utf-8")
        self.assertEqual(log.count("did not acknowledge"), 4)
        self.assertNotIn("synthetic-secret", log)

    def test_bad_acknowledgement_is_fail_open_and_logged(self):
        completed = subprocess.CompletedProcess([], 0, '{"status":"saved"}', "")
        with (
            mock.patch.object(self.module, "find_nmem_command", return_value="nmem"),
            mock.patch.object(self.module.subprocess, "run", return_value=completed),
        ):
            self.assertEqual(self.module.main(), 0)
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})

        self.assertIn(
            "did not acknowledge",
            (Path(self.temp_dir.name) / "capture.log").read_text(encoding="utf-8"),
        )

    def test_missing_cli_is_fail_open(self):
        with mock.patch.object(self.module, "find_nmem_command", return_value=None):
            self.assertEqual(self.module.main(), 0)
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})

        self.assertIn(
            "was not found",
            (Path(self.temp_dir.name) / "capture.log").read_text(encoding="utf-8"),
        )

    def test_explicit_cli_path_works_with_a_restricted_path(self):
        executable = Path(self.temp_dir.name) / "nmem"
        executable.write_text("#!/bin/sh\n", encoding="utf-8")
        executable.chmod(0o755)
        with mock.patch.dict(
            self.module.os.environ,
            {"NMEM_CLI_PATH": str(executable), "PATH": ""},
            clear=False,
        ):
            self.assertEqual(self.module.find_nmem_command(), str(executable))

    def test_windows_capture_hides_the_child_window(self):
        completed = subprocess.CompletedProcess([], 0, '{"status":"enqueued"}', "")
        with (
            mock.patch.object(self.module, "find_nmem_command", return_value="nmem"),
            mock.patch.object(
                self.module,
                "windows_no_window_kwargs",
                return_value={"creationflags": 42},
            ),
            mock.patch.object(
                self.module.subprocess, "run", return_value=completed
            ) as run,
        ):
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})

        self.assertEqual(run.call_args.kwargs["creationflags"], 42)

    def test_diagnostics_are_bounded(self):
        for _ in range(1024):
            self.module._log("x" * 128)

        self.assertLessEqual(
            (Path(self.temp_dir.name) / "capture.log").stat().st_size, 64 * 1024
        )

    def test_payload_parser_rejects_non_object_json(self):
        self.assertEqual(self.module._read_payload(io.StringIO("[]")), {})
        self.assertEqual(self.module._read_payload(io.StringIO("not json")), {})

    def test_hooks_declare_the_required_events_and_platform_launchers(self):
        hooks = json.loads(
            (PLUGIN_ROOT / "hooks" / "hooks.json").read_text(encoding="utf-8")
        )
        self.assertEqual(set(hooks["hooks"]), {"PreCompact", "Stop", "SubagentStop"})
        for event in hooks["hooks"].values():
            hook = event[0]["hooks"][0]
            self.assertIn("CLAUDE_PLUGIN_ROOT", hook["command"])
            self.assertIn("commandWindows", hook)
            self.assertIn("nmem-capture.py", hook["commandWindows"])

    def test_manifest_is_dimagent_specific_and_codex_compatible(self):
        manifest = json.loads(
            (PLUGIN_ROOT / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8")
        )
        self.assertEqual(manifest["name"], "nowledge-mem-dimagent")
        self.assertEqual(manifest["hooks"], "./hooks/hooks.json")
        self.assertEqual(manifest["mcpServers"], "./.mcp.json")

    def test_registry_and_marketplace_advertise_the_package(self):
        community_root = PLUGIN_ROOT.parent
        registry = json.loads(
            (community_root / "integrations.json").read_text(encoding="utf-8")
        )
        integration = next(
            entry for entry in registry["integrations"] if entry["id"] == "dimagent"
        )
        self.assertEqual(integration["directory"], PLUGIN_ROOT.name)
        self.assertEqual(integration["version"], "0.1.0")
        self.assertTrue(integration["capabilities"]["autoCapture"])
        self.assertEqual(integration["autonomy"]["threads"], "automatic-capture")
        self.assertIn("dimagent", registry["connect"]["appliesTo"])
        guide = integration["install"]["agentGuide"]
        self.assertIn("Context Bundle or Working Memory check", guide["prompt"])
        self.assertIn("Context Bundle 或 Working Memory 检查", guide["promptZh"])

        marketplace = json.loads(
            (community_root / ".agents" / "plugins" / "marketplace.json").read_text(
                encoding="utf-8"
            )
        )
        package = next(
            entry
            for entry in marketplace["plugins"]
            if entry["name"] == "nowledge-mem-dimagent"
        )
        self.assertEqual(package["source"]["path"], "./nowledge-mem-dimagent-plugin")


class DimAgentLauncherTests(unittest.TestCase):
    def run_hook(self, event, acknowledgement='{"status":"enqueued"}'):
        hooks = json.loads(
            (PLUGIN_ROOT / "hooks" / "hooks.json").read_text(encoding="utf-8")
        )
        field = "commandWindows" if os.name == "nt" else "command"
        command = hooks["hooks"][event][0]["hooks"][0][field]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plugin = root / "plugin with spaces"
            shutil.copytree(
                PLUGIN_ROOT / "hooks",
                plugin / "hooks",
                ignore=shutil.ignore_patterns("__pycache__"),
            )
            cwd = root / "unrelated project"
            cwd.mkdir()
            record = root / "calls.jsonl"
            fake = root / "fake_nmem.py"
            fake.write_text(
                "import json, os, sys\n"
                "with open(os.environ['DIMAGENT_TEST_RECORD'], 'a', encoding='utf-8') as output:\n"
                "    output.write(json.dumps(sys.argv[1:]) + '\\n')\n"
                "print(os.environ['DIMAGENT_TEST_ACK'])\n",
                encoding="utf-8",
            )
            launcher = root / ("nmem.cmd" if os.name == "nt" else "nmem")
            if os.name == "nt":
                launcher.write_text(
                    f'@echo off\n"{sys.executable}" "{fake}" %*\n', encoding="utf-8"
                )
            else:
                launcher.write_text(
                    f'#!/bin/sh\nexec {shlex.quote(sys.executable)} {shlex.quote(str(fake))} "$@"\n',
                    encoding="utf-8",
                )
                launcher.chmod(0o755)
            env = os.environ.copy()
            env.pop("PYTHONPATH", None)
            env.update(
                {
                    "CLAUDE_PLUGIN_ROOT": str(plugin),
                    "DIMCODE_HOME": str(root / "dimagent"),
                    "NMEM_CLI_PATH": str(launcher),
                    "DIMAGENT_TEST_RECORD": str(record),
                    "DIMAGENT_TEST_ACK": acknowledgement,
                    "NMEM_API_KEY": "synthetic-key-must-not-appear",
                }
            )
            payload = {
                "hook_event_name": event,
                "session_id": "parent-session",
                "agent_id": "child-session",
                "messages": [{"text": "synthetic-transcript-must-not-appear"}],
            }
            completed = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                env=env,
                input=json.dumps(payload),
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=20,
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(completed.stdout, "")
            self.assertEqual(completed.stderr, "")
            self.assertTrue(record.is_file(), "The real launcher must invoke nmem")
            calls = [
                json.loads(line)
                for line in record.read_text(encoding="utf-8").splitlines()
            ]
            selected = "child-session" if event == "SubagentStop" else "parent-session"
            self.assertEqual(
                calls,
                [
                    [
                        "--json",
                        "t",
                        "capture",
                        "--from",
                        "dimagent",
                        "--session-id",
                        selected,
                    ]
                ],
            )
            log = root / "dimagent" / "logs" / "nowledge-mem-capture.log"
            diagnostic = log.read_text(encoding="utf-8") if log.is_file() else ""
            self.assertNotIn("synthetic-key-must-not-appear", diagnostic)
            self.assertNotIn("synthetic-transcript-must-not-appear", diagnostic)
            return diagnostic

    def test_registered_launchers_capture_each_event_from_unrelated_cwd(self):
        for event in ("Stop", "PreCompact", "SubagentStop"):
            with self.subTest(event=event):
                self.assertEqual(self.run_hook(event), "")

    def test_registered_launcher_rejects_negative_ack_without_blocking_host(self):
        diagnostic = self.run_hook("Stop", '{"status":"saved"}')
        self.assertIn("did not acknowledge", diagnostic)


if __name__ == "__main__":
    unittest.main()
