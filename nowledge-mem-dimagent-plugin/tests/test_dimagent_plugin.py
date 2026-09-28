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

    def test_untrusted_or_oversized_session_id_never_reaches_cli(self):
        invalid_ids = (
            "session&echo injected",
            "session|more",
            "%PATH%",
            "session with spaces",
            "session/child",
            "s" * 257,
        )
        for session_id in invalid_ids:
            with (
                self.subTest(session_id=session_id),
                mock.patch.object(self.module, "find_nmem_command") as resolve,
            ):
                self.module._capture(
                    {"hook_event_name": "Stop", "session_id": session_id}
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

    @unittest.skipIf(os.name == "nt", "Windows invokes batch launchers directly")
    def test_missing_trusted_command_launcher_is_fail_open(self):
        with (
            mock.patch.object(
                self.module, "find_nmem_command", return_value="/opt/nmem/nmem.cmd"
            ),
            mock.patch.object(
                sys.modules["nmem_runtime"], "_windows_cmd_command", return_value=None
            ),
            mock.patch.object(self.module.subprocess, "run") as run,
        ):
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})
            run.assert_not_called()
        log = (Path(self.temp_dir.name) / "capture.log").read_text(encoding="utf-8")
        self.assertIn("invocation failed", log)
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

    @unittest.skipUnless(os.name == "nt", "Requires Windows PATHEXT resolution")
    def test_absolute_cli_override_resolves_extension_before_path_fallback(self):
        root = Path(self.temp_dir.name)
        preferred = root / "preferred"
        fallback = root / "fallback"
        preferred.mkdir()
        fallback.mkdir()
        (preferred / "nmem.exe").touch()
        (fallback / "nmem.cmd").touch()
        with mock.patch.dict(
            os.environ,
            {
                "NMEM_CLI_PATH": str(preferred / "nmem"),
                "PATH": str(fallback),
                "PATHEXT": ".CMD;.EXE",
            },
        ):
            self.assertEqual(
                Path(self.module.find_nmem_command()), preferred / "nmem.exe"
            )

    @unittest.skipUnless(os.name == "nt", "Requires Windows PATHEXT resolution")
    def test_empty_pathext_uses_default_extensions(self):
        root = Path(self.temp_dir.name)
        executable = root / "nmem.exe"
        executable.touch()
        with mock.patch.dict(
            os.environ,
            {"NMEM_CLI_PATH": "", "PATH": str(root), "PATHEXT": ""},
        ):
            self.assertEqual(Path(self.module.find_nmem_command()), executable)

    @unittest.skipUnless(os.name == "nt", "Requires Windows PATHEXT resolution")
    def test_custom_pathext_order_selects_the_first_extension(self):
        root = Path(self.temp_dir.name)
        (root / "nmem.exe").touch()
        (root / "nmem.cmd").touch()
        for extensions, expected in (
            (".CMD;.EXE", "nmem.cmd"),
            (".EXE;.CMD", "nmem.exe"),
        ):
            with (
                self.subTest(extensions=extensions),
                mock.patch.dict(
                    os.environ,
                    {"NMEM_CLI_PATH": "", "PATH": str(root), "PATHEXT": extensions},
                ),
            ):
                self.assertEqual(Path(self.module.find_nmem_command()), root / expected)

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
            self.assertIn("launch-capture.sh", hook["command"])
            self.assertIn("launch-capture.ps1", hook["commandWindows"])
            self.assertIn("%SystemRoot%", hook["commandWindows"])

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
        self.assertEqual(registry["version"], "1.2.5")
        self.assertEqual(
            integration["install"]["docsUrl"],
            "https://github.com/nowledge-co/community/tree/main/"
            "nowledge-mem-dimagent-plugin#readme",
        )
        guide = integration["install"]["agentGuide"]
        self.assertIn("Context Bundle or Working Memory check", guide["prompt"])
        self.assertIn("Context Bundle 或 Working Memory 检查", guide["promptZh"])

        readme = (community_root / "README.md").read_text(encoding="utf-8")
        self.assertIn("[DimAgent Plugin](nowledge-mem-dimagent-plugin)", readme)
        integration_skill = (
            community_root
            / "nowledge-mem-npx-skills"
            / "skills"
            / "check-integration"
            / "SKILL.md"
        ).read_text(encoding="utf-8")
        self.assertIn("| **DimAgent** |", integration_skill)
        self.assertIn(
            "No verified host-specific marketplace command", integration_skill
        )

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
    def run_hook(
        self,
        event,
        acknowledgement='{"status":"enqueued"}',
        *,
        shadow_modules=False,
        shadow_interpreter=False,
        no_interpreter=False,
        discover_cli=False,
        relative_path=False,
    ):
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
            shadow_marker = root / "project-code-executed"
            if shadow_interpreter:
                names = (
                    ("py.cmd", "python.cmd", "python3.cmd")
                    if os.name == "nt"
                    else ("python3", "python")
                )
                for name in names:
                    shadow = cwd / name
                    if os.name == "nt":
                        shadow.write_text(
                            f'@echo off\necho unexpected > "{shadow_marker}"\nexit /b 1\n',
                            encoding="utf-8",
                        )
                    else:
                        shadow.write_text(
                            f"#!/bin/sh\nprintf unexpected > {shlex.quote(str(shadow_marker))}\nexit 1\n",
                            encoding="utf-8",
                        )
                        shadow.chmod(0o755)
            if shadow_modules:
                (cwd / "json.py").write_text(
                    f"open({str(shadow_marker)!r}, 'w').write('unexpected')\n"
                    "raise RuntimeError('Project module must not execute')\n",
                    encoding="utf-8",
                )
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
            if discover_cli:
                shadow_cli = cwd / launcher.name
                if os.name == "nt":
                    shadow_cli.write_text(
                        f'@echo off\necho unexpected > "{shadow_marker}"\nexit /b 1\n',
                        encoding="utf-8",
                    )
                else:
                    shadow_cli.write_text(
                        f"#!/bin/sh\nprintf unexpected > {shlex.quote(str(shadow_marker))}\nexit 1\n",
                        encoding="utf-8",
                    )
                    shadow_cli.chmod(0o755)
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
            if discover_cli:
                env.pop("NMEM_CLI_PATH", None)
                entries = [str(root), env.get("PATH", os.defpath)]
                if relative_path:
                    entries.insert(0, ".")
                env["PATH"] = os.pathsep.join(entries)
            if shadow_interpreter:
                env["PATH"] = os.pathsep.join([".", env.get("PATH", os.defpath)])
            if no_interpreter:
                env["PATH"] = "."
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
            self.assertFalse(shadow_marker.exists(), "Project code must not execute")
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(completed.stdout, "")
            self.assertEqual(completed.stderr, "")
            if no_interpreter:
                self.assertFalse(
                    record.exists(), "Missing interpreter must not call CLI"
                )
                diagnostic = (
                    Path(env["DIMCODE_HOME"])
                    / "logs"
                    / "nowledge-mem-capture-bootstrap.log"
                )
                self.assertTrue(
                    diagnostic.is_file(), "Missing interpreter must be diagnosed"
                )
                self.assertLess(diagnostic.stat().st_size, 1024)
                return diagnostic.read_text(encoding="utf-8")
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

    def test_registered_launcher_ignores_project_python_modules(self):
        for event in ("Stop", "PreCompact", "SubagentStop"):
            with self.subTest(event=event):
                self.assertEqual(self.run_hook(event, shadow_modules=True), "")

    def test_registered_launchers_ignore_project_interpreters(self):
        for event in ("Stop", "PreCompact", "SubagentStop"):
            with self.subTest(event=event):
                self.assertEqual(self.run_hook(event, shadow_interpreter=True), "")

    def test_missing_trusted_interpreter_is_diagnosed_without_project_fallback(self):
        for event in ("Stop", "PreCompact", "SubagentStop"):
            with self.subTest(event=event):
                diagnostic = self.run_hook(
                    event, shadow_interpreter=True, no_interpreter=True
                )
                self.assertEqual(
                    diagnostic,
                    "capture skipped: trusted Python launcher unavailable or failed\n",
                )

    def test_registered_launcher_does_not_implicitly_discover_project_cli(self):
        self.assertEqual(self.run_hook("Stop", discover_cli=True), "")

    def test_registered_launcher_ignores_relative_path_cli(self):
        self.assertEqual(
            self.run_hook("Stop", discover_cli=True, relative_path=True), ""
        )


if __name__ == "__main__":
    unittest.main()
