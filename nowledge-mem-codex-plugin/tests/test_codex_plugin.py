import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from types import SimpleNamespace


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
        temp_path = Path(self.temp_dir.name)
        self.module.LOG_FILE = temp_path / "nmem-stop-hook.log"
        self.module.STATE_FILE = temp_path / "hook-state.json"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_missing_transcript_path_skips_before_path_construction(self):
        status, output = self.module.import_current_transcript(
            {
                "session_id": "session-1",
                "cwd": "/tmp/project",
                "hook_event_name": "Stop",
            }
        )

        self.assertEqual(status, 0)
        self.assertIn("transcript_path missing or unreadable", output)

    def test_directory_transcript_path_is_rejected(self):
        temp_path = Path(self.temp_dir.name)

        status, output = self.module.import_current_transcript(
            {
                "session_id": "session-2",
                "cwd": "/tmp/project",
                "hook_event_name": "Stop",
                "transcript_path": str(temp_path),
            }
        )

        self.assertEqual(status, 0)
        self.assertIn("transcript_path missing or unreadable", output)

    def test_timeout_from_nmem_is_reported_and_state_not_written(self):
        transcript_path = Path(self.temp_dir.name) / "rollout.jsonl"
        transcript_path.write_text("placeholder", encoding="utf-8")

        parsed = {
            "thread_id": "codex-timeout-thread",
            "title": "Timeout thread",
            "messages": [{"role": "user", "content": "hi"}],
        }

        with mock.patch.object(self.module.shutil, "which", return_value="/usr/bin/nmem"), \
             mock.patch.dict("sys.modules", {"nmem_cli.session_import": mock.Mock(parse_codex_session_streaming=mock.Mock(return_value=parsed))}), \
             mock.patch.object(
                 self.module.subprocess,
                 "run",
                 side_effect=subprocess.TimeoutExpired(["nmem"], timeout=5),
             ):
            status, output = self.module.import_current_transcript(
                {
                    "session_id": "session-3",
                    "cwd": "/tmp/project",
                    "hook_event_name": "Stop",
                    "transcript_path": str(transcript_path),
                }
            )

        self.assertEqual(status, 0)
        self.assertIn("timed out", output)
        self.assertFalse(self.module.STATE_FILE.exists())

    def test_resolve_nmem_command_falls_back_to_uvx(self):
        with mock.patch.object(
            self.module.shutil,
            "which",
            side_effect=[None, None, "/usr/bin/uvx", None],
        ):
            command = self.module.resolve_nmem_command()

        self.assertEqual(command, ["/usr/bin/uvx", "--from", "nmem-cli", "nmem"])

    def test_subsequent_import_only_sends_delta_messages(self):
        transcript_path = Path(self.temp_dir.name) / "rollout.jsonl"
        transcript_path.write_text("placeholder", encoding="utf-8")

        parsed_first = {
            "thread_id": "codex-delta-thread",
            "title": "Delta thread",
            "messages": [
                {"role": "user", "content": "u1"},
                {"role": "assistant", "content": "a1"},
            ],
        }
        parsed_second = {
            "thread_id": "codex-delta-thread",
            "title": "Delta thread",
            "messages": [
                {"role": "user", "content": "u1"},
                {"role": "assistant", "content": "a1"},
                {"role": "user", "content": "u2"},
            ],
        }

        captured_payloads = []

        def fake_run(command, capture_output, text, env, timeout):
            payload_path = Path(command[command.index("-f") + 1])
            captured_payloads.append(json.loads(payload_path.read_text(encoding="utf-8")))
            return SimpleNamespace(returncode=0, stdout='{"success": true}', stderr="")

        parser_mock = mock.Mock(side_effect=[parsed_first, parsed_second])
        with mock.patch.object(self.module.shutil, "which", return_value="/usr/bin/nmem"), \
             mock.patch.dict("sys.modules", {"nmem_cli.session_import": mock.Mock(parse_codex_session_streaming=parser_mock)}), \
             mock.patch.object(self.module.subprocess, "run", side_effect=fake_run):
            first_status, _ = self.module.import_current_transcript(
                {
                    "session_id": "session-delta",
                    "cwd": "/tmp/project",
                    "hook_event_name": "Stop",
                    "transcript_path": str(transcript_path),
                }
            )
            second_status, _ = self.module.import_current_transcript(
                {
                    "session_id": "session-delta",
                    "cwd": "/tmp/project",
                    "hook_event_name": "Stop",
                    "transcript_path": str(transcript_path),
                }
            )

        self.assertEqual(first_status, 0)
        self.assertEqual(second_status, 0)
        self.assertEqual(len(captured_payloads[0]["messages"]), 2)
        self.assertEqual(captured_payloads[0]["messages"][0]["content"], "u1")
        self.assertEqual(len(captured_payloads[1]["messages"]), 1)
        self.assertEqual(captured_payloads[1]["messages"][0]["content"], "u2")

    def test_title_skips_agents_preamble_and_uses_first_real_user_message(self):
        parsed = {
            "title": "# AGENTS.md instructions for /Users/hansonmei/Projects/nowledge-community",
            "messages": [
                {"role": "developer", "content": "<permissions instructions>..."},
                {
                    "role": "user",
                    "content": "# AGENTS.md instructions for /Users/hansonmei/Projects/nowledge-community\n\n<INSTRUCTIONS>...",
                },
                {
                    "role": "user",
                    "content": "codex://threads/019d7145-eb73-7840-84e5-bef5c0f19261，你看看这个对话里的修改是不是已经落盘到本目录了",
                },
            ],
        }

        title = self.module.derive_thread_title(parsed, "/Users/hansonmei/Projects/nowledge-community")

        self.assertEqual(
            title,
            "这个对话里的修改是否已经落盘到本目录了",
        )

    def test_title_falls_back_to_workspace_name_when_only_agents_preamble_exists(self):
        parsed = {
            "title": "# AGENTS.md instructions for /Users/hansonmei/Projects/nowledge-community",
            "messages": [
                {
                    "role": "user",
                    "content": "# AGENTS.md instructions for /Users/hansonmei/Projects/nowledge-community\n\n<INSTRUCTIONS>...",
                }
            ],
        }

        title = self.module.derive_thread_title(parsed, "/Users/hansonmei/Projects/nowledge-community")

        self.assertEqual(title, "Codex: nowledge-community")

    def test_title_skips_environment_context_blocks(self):
        parsed = {
            "title": "# AGENTS.md instructions for /Users/hansonmei",
            "messages": [
                {"role": "user", "content": "# AGENTS.md instructions for /Users/hansonmei\n\n<INSTRUCTIONS>..."},
                {
                    "role": "user",
                    "content": "<environment_context>\n  <cwd>/Users/hansonmei</cwd>\n</environment_context>",
                },
                {"role": "user", "content": "更新我的openclaw"},
            ],
        }

        title = self.module.derive_thread_title(parsed, "/Users/hansonmei")

        self.assertEqual(title, "更新我的openclaw")

    def test_title_skips_generic_agents_document_blocks(self):
        parsed = {
            "title": "# AGENTS.md",
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "# AGENTS.md\n\n"
                        "## Purpose\n\n"
                        "only applicable in codex app\n\n"
                        "<INSTRUCTIONS>\n"
                        "Use nmem.\n"
                        "</INSTRUCTIONS>"
                    ),
                },
                {"role": "user", "content": "codex app 支持hook吗"},
            ],
        }

        title = self.module.derive_thread_title(parsed, "/Users/hansonmei")

        self.assertEqual(title, "codex app 支持hook吗")

    def test_title_extracts_request_from_files_preamble(self):
        parsed = {
            "title": "# AGENTS.md instructions for /Users/hansonmei",
            "messages": [
                {"role": "user", "content": "# AGENTS.md instructions for /Users/hansonmei\n\n<INSTRUCTIONS>..."},
                {
                    "role": "user",
                    "content": (
                        "# Files mentioned by the user:\n\n"
                        "## a.png: /tmp/a.png\n\n"
                        "## My request for Codex:\n"
                        "这三张截图都要提取文字，必要时可以先切分再提取"
                    ),
                },
            ],
        }

        title = self.module.derive_thread_title(parsed, "/Users/hansonmei")

        self.assertEqual(title, "这三张截图都要提取文字，必要时可以先切分再提取")


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

    def test_ensure_codex_hooks_enabled_replaces_indented_key_without_duplication(self):
        self.module.CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.CONFIG_FILE.write_text(
            "\n".join(
                [
                    "[features]",
                    "  codex_hooks = false",
                    "apps = true",
                    "",
                ]
            ),
            encoding="utf-8",
        )

        self.module.ensure_codex_hooks_enabled()
        updated = self.module.CONFIG_FILE.read_text(encoding="utf-8")

        self.assertEqual(updated.count("codex_hooks = true"), 1)
        self.assertNotIn("codex_hooks = false", updated)
        self.assertIn("[features]\ncodex_hooks = true\napps = true\n", updated)


if __name__ == "__main__":
    unittest.main()
