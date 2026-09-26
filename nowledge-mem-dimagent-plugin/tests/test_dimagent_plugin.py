import importlib.util
import io
import json
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
    sys.path.insert(0, str(HOOK_PATH.parent))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.pop(0)
    return module


class DimAgentCaptureTests(unittest.TestCase):
    def setUp(self):
        self.module = load_hook()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.module._log_path = lambda: Path(self.temp_dir.name) / "capture.log"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_regular_events_use_session_id(self):
        self.assertEqual(
            self.module._capture_id({"hook_event_name": "Stop", "session_id": "session-1"}),
            "session-1",
        )

    def test_subagent_stop_uses_agent_id(self):
        self.assertEqual(
            self.module._capture_id(
                {"hook_event_name": "SubagentStop", "session_id": "parent", "agent_id": "child-1"}
            ),
            "child-1",
        )

    def test_capture_only_accepts_enqueued_acknowledgement(self):
        completed = subprocess.CompletedProcess([], 0, '{"status":"enqueued"}', "")
        with mock.patch.object(self.module, "find_nmem_command", return_value="/usr/local/bin/nmem"), mock.patch.object(
            self.module.subprocess, "run", return_value=completed
        ) as run:
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})

        self.assertEqual(
            run.call_args.args[0],
            ["/usr/local/bin/nmem", "--json", "t", "capture", "--from", "dimagent", "--session-id", "session-1"],
        )
        self.assertFalse((Path(self.temp_dir.name) / "capture.log").exists())

    def test_bad_acknowledgement_is_fail_open_and_logged(self):
        completed = subprocess.CompletedProcess([], 0, '{"status":"saved"}', "")
        with mock.patch.object(self.module, "find_nmem_command", return_value="nmem"), mock.patch.object(
            self.module.subprocess, "run", return_value=completed
        ):
            self.assertEqual(self.module.main(), 0)
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})

        self.assertIn("did not acknowledge", (Path(self.temp_dir.name) / "capture.log").read_text())

    def test_missing_cli_is_fail_open(self):
        with mock.patch.object(self.module, "find_nmem_command", return_value=None):
            self.assertEqual(self.module.main(), 0)
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})

        self.assertIn("was not found", (Path(self.temp_dir.name) / "capture.log").read_text())

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
        with mock.patch.object(self.module, "find_nmem_command", return_value="nmem"), mock.patch.object(
            self.module, "windows_no_window_kwargs", return_value={"creationflags": 42}
        ), mock.patch.object(self.module.subprocess, "run", return_value=completed) as run:
            self.module._capture({"hook_event_name": "Stop", "session_id": "session-1"})

        self.assertEqual(run.call_args.kwargs["creationflags"], 42)

    def test_diagnostics_are_bounded(self):
        for _ in range(1024):
            self.module._log("x" * 128)

        self.assertLessEqual((Path(self.temp_dir.name) / "capture.log").stat().st_size, 64 * 1024)

    def test_payload_parser_rejects_non_object_json(self):
        self.assertEqual(self.module._read_payload(io.StringIO("[]")), {})
        self.assertEqual(self.module._read_payload(io.StringIO("not json")), {})

    def test_hooks_declare_the_required_events_and_platform_launchers(self):
        hooks = json.loads((PLUGIN_ROOT / "hooks" / "hooks.json").read_text())
        self.assertEqual(set(hooks["hooks"]), {"PreCompact", "Stop", "SubagentStop"})
        for event in hooks["hooks"].values():
            hook = event[0]["hooks"][0]
            self.assertIn("CLAUDE_PLUGIN_ROOT", hook["command"])
            self.assertIn("commandWindows", hook)
            self.assertIn("nmem-capture.py", hook["commandWindows"])

    def test_manifest_is_dimagent_specific_and_codex_compatible(self):
        manifest = json.loads((PLUGIN_ROOT / ".codex-plugin" / "plugin.json").read_text())
        self.assertEqual(manifest["name"], "nowledge-mem-dimagent")
        self.assertEqual(manifest["hooks"], "./hooks/hooks.json")
        self.assertEqual(manifest["mcpServers"], "./.mcp.json")

    def test_registry_and_marketplace_advertise_the_package(self):
        community_root = PLUGIN_ROOT.parent
        registry = json.loads((community_root / "integrations.json").read_text())
        integration = next(entry for entry in registry["integrations"] if entry["id"] == "dimagent")
        self.assertEqual(integration["directory"], PLUGIN_ROOT.name)
        self.assertEqual(integration["version"], "0.1.0")
        self.assertTrue(integration["capabilities"]["autoCapture"])
        self.assertEqual(integration["autonomy"]["threads"], "automatic-capture")
        self.assertIn("dimagent", registry["connect"]["appliesTo"])

        marketplace = json.loads(
            (community_root / ".agents" / "plugins" / "marketplace.json").read_text()
        )
        package = next(
            entry for entry in marketplace["plugins"] if entry["name"] == "nowledge-mem-dimagent"
        )
        self.assertEqual(package["source"]["path"], "./nowledge-mem-dimagent-plugin")


if __name__ == "__main__":
    unittest.main()
