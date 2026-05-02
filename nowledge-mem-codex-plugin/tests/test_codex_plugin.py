import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOOK_MODULE_PATH = PLUGIN_ROOT / "hooks" / "nmem-stop-save.py"
INSTALL_MODULE_PATH = PLUGIN_ROOT / "scripts" / "install_hooks.py"


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
        self.module._log_path = lambda: self.temp_path / "nmem-stop-hook.log"

    def tearDown(self):
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
                "/tmp/project",
                "--session-id",
                "019abc",
            ],
        )

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

    def test_derive_codex_home_from_transcript_path(self):
        transcript = self.temp_path / "sessions" / "2026" / "05" / "02" / "rollout-abc.jsonl"
        transcript.parent.mkdir(parents=True)
        transcript.write_text("", encoding="utf-8")

        self.assertEqual(self.module._derive_codex_home(str(transcript)), self.temp_path)

    def test_missing_nmem_is_non_fatal(self):
        with mock.patch.object(self.module, "_nmem_command", return_value=None), \
             mock.patch.object(self.module.sys, "stdin", mock.Mock(read=lambda: "{}")):
            self.assertEqual(self.module.main(), 0)


class InstallHookTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module("install_hooks", INSTALL_MODULE_PATH)
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_path = Path(self.temp_dir.name)
        self.module.CODEX_DIR = temp_path / ".codex"
        self.module.HOOKS_DIR = self.module.CODEX_DIR / "hooks"
        self.module.GLOBAL_HOOKS_FILE = self.module.CODEX_DIR / "hooks.json"
        self.module.CONFIG_FILE = self.module.CODEX_DIR / "config.toml"
        self.module.INSTALLED_HOOK = self.module.HOOKS_DIR / "nowledge-mem-stop-save.py"

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
        self.assertIn("[features]\napps = true\ncodex_hooks = true", updated)

    def test_ensure_codex_hooks_enabled_rejects_invalid_toml(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text("[features\ncodex_hooks = false\n", encoding="utf-8")

        with self.assertRaises(SystemExit):
            self.module.ensure_codex_hooks_enabled()

        self.assertEqual(
            self.module.CONFIG_FILE.read_text(encoding="utf-8"),
            "[features\ncodex_hooks = false\n",
        )

    def test_install_runtime_hook_copies_runtime(self):
        self.module.install_runtime_hook()

        self.assertTrue(self.module.INSTALLED_HOOK.exists())
        self.assertIn("Best-effort Codex transcript capture", self.module.INSTALLED_HOOK.read_text())


if __name__ == "__main__":
    unittest.main()
