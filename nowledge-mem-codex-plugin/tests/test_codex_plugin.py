import importlib.util
import tempfile
import unittest
from pathlib import Path
from types import ModuleType
from unittest import mock


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
HOOK_MODULE_PATH = PLUGIN_ROOT / "hooks" / "nmem-stop-save.py"
INSTALL_MODULE_PATH = PLUGIN_ROOT / "scripts" / "install_hooks.py"
REFRESH_MODULE_PATH = PLUGIN_ROOT / "scripts" / "refresh_thread_titles.py"


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

    def patch_nmem_modules(self, *, parser, api_get_optional=None, api_post=None):
        package = ModuleType("nmem_cli")
        cli_module = ModuleType("nmem_cli.cli")
        cli_module.api_get_optional = api_get_optional or mock.Mock(return_value=None)
        cli_module.api_post = api_post or mock.Mock()
        session_module = ModuleType("nmem_cli.session_import")
        session_module.parse_codex_session_streaming = parser
        return mock.patch.dict(
            "sys.modules",
            {
                "nmem_cli": package,
                "nmem_cli.cli": cli_module,
                "nmem_cli.session_import": session_module,
            },
        )

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

    def test_api_sync_failure_is_reported_and_state_not_written(self):
        transcript_path = Path(self.temp_dir.name) / "rollout.jsonl"
        transcript_path.write_text("placeholder", encoding="utf-8")

        parsed = {
            "thread_id": "codex-error-thread",
            "title": "Error thread",
            "messages": [{"role": "user", "content": "hi"}],
        }

        parser_mock = mock.Mock(return_value=parsed)
        api_post = mock.Mock(side_effect=RuntimeError("boom"))
        with self.patch_nmem_modules(
            parser=parser_mock,
            api_get_optional=mock.Mock(return_value=None),
            api_post=api_post,
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
        self.assertIn("failed to sync", output)
        self.assertFalse(self.module.STATE_FILE.exists())

    def test_load_json_returns_empty_dict_for_non_object_json(self):
        payload_path = Path(self.temp_dir.name) / "payload.json"
        payload_path.write_text('["not", "a", "dict"]', encoding="utf-8")

        payload = self.module.load_json(payload_path)

        self.assertEqual(payload, {})

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

        parser_mock = mock.Mock(side_effect=[parsed_first, parsed_second])
        api_get_optional = mock.Mock(side_effect=[None, {"thread": {"thread_id": "codex-delta-thread"}}])
        api_post = mock.Mock()
        with self.patch_nmem_modules(
            parser=parser_mock,
            api_get_optional=api_get_optional,
            api_post=api_post,
        ):
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
        self.assertEqual(api_post.call_count, 2)

        create_endpoint, create_payload = api_post.call_args_list[0].args
        self.assertEqual(create_endpoint, "/threads")
        self.assertEqual(len(create_payload["messages"]), 2)
        self.assertEqual(create_payload["messages"][0]["content"], "u1")

        append_endpoint, append_payload = api_post.call_args_list[1].args
        self.assertEqual(append_endpoint, "/threads/codex-delta-thread/append")
        self.assertTrue(append_payload["deduplicate"])
        self.assertEqual(len(append_payload["messages"]), 1)
        self.assertEqual(append_payload["messages"][0]["content"], "u2")

    def test_malformed_messages_are_filtered_before_sync(self):
        transcript_path = Path(self.temp_dir.name) / "rollout.jsonl"
        transcript_path.write_text("placeholder", encoding="utf-8")

        parsed = {
            "thread_id": "codex-filter-thread",
            "title": "Filter thread",
            "messages": [
                {"role": "user", "content": "u1"},
                {"content": "missing-role"},
                "bad-entry",
                {"role": "assistant", "content": "a1"},
            ],
        }

        api_post = mock.Mock()
        with self.patch_nmem_modules(
            parser=mock.Mock(return_value=parsed),
            api_get_optional=mock.Mock(return_value=None),
            api_post=api_post,
        ):
            status, _ = self.module.import_current_transcript(
                {
                    "session_id": "session-filter",
                    "cwd": "/tmp/project",
                    "hook_event_name": "Stop",
                    "transcript_path": str(transcript_path),
                }
            )

        self.assertEqual(status, 0)
        _, payload = api_post.call_args.args
        self.assertEqual(
            payload["messages"],
            [
                {"role": "user", "content": "u1"},
                {"role": "assistant", "content": "a1"},
            ],
        )

    def test_state_lock_times_out_when_contended(self):
        with mock.patch.object(self.module.fcntl, "flock", side_effect=BlockingIOError), \
             mock.patch.object(
                 self.module.time,
                 "monotonic",
                 side_effect=[0.0, 0.0, 0.2, 0.4],
             ), \
             mock.patch.object(self.module.time, "sleep"):
            with self.assertRaises(TimeoutError):
                with self.module.state_lock(timeout_seconds=0.3):
                    self.fail("lock should not be acquired")

    def test_missing_remote_thread_recreates_full_transcript(self):
        transcript_path = Path(self.temp_dir.name) / "rollout.jsonl"
        transcript_path.write_text("placeholder", encoding="utf-8")

        parsed = {
            "thread_id": "codex-recreate-thread",
            "title": "Recreate thread",
            "messages": [
                {"role": "user", "content": "u1"},
                {"role": "assistant", "content": "a1"},
                {"role": "user", "content": "u2"},
            ],
        }

        state = {
            "session-recreate": {
                "thread_id": "codex-recreate-thread",
                "message_count": 2,
                "source_file": str(transcript_path),
            }
        }
        self.module.save_json(self.module.STATE_FILE, state)

        api_post = mock.Mock()
        with self.patch_nmem_modules(
            parser=mock.Mock(return_value=parsed),
            api_get_optional=mock.Mock(return_value=None),
            api_post=api_post,
        ):
            status, _ = self.module.import_current_transcript(
                {
                    "session_id": "session-recreate",
                    "cwd": "/tmp/project",
                    "hook_event_name": "Stop",
                    "transcript_path": str(transcript_path),
                }
            )

        self.assertEqual(status, 0)
        endpoint, payload = api_post.call_args.args
        self.assertEqual(endpoint, "/threads")
        self.assertEqual(len(payload["messages"]), 3)

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

    def test_load_json_recovers_from_non_object_json(self):
        self.module.GLOBAL_HOOKS_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.GLOBAL_HOOKS_FILE.write_text('["not-an-object"]', encoding="utf-8")

        payload = self.module.load_json(self.module.GLOBAL_HOOKS_FILE)

        self.assertEqual(payload, {})
        backups = list(self.module.GLOBAL_HOOKS_FILE.parent.glob("hooks.json.*.bak"))
        self.assertEqual(len(backups), 1)

    def test_merge_hooks_json_normalizes_malformed_stop_section(self):
        self.module.GLOBAL_HOOKS_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.GLOBAL_HOOKS_FILE.write_text(
            '{"hooks": {"Stop": {"matcher": ".*"}}}',
            encoding="utf-8",
        )

        self.module.merge_hooks_json()
        payload = self.module.load_json(self.module.GLOBAL_HOOKS_FILE)

        self.assertIsInstance(payload["hooks"]["Stop"], list)
        self.assertEqual(len(payload["hooks"]["Stop"]), 1)
        self.assertEqual(
            payload["hooks"]["Stop"][0]["hooks"][0]["command"],
            str(self.module.INSTALLED_HOOK),
        )

    def test_merge_hooks_json_preserves_existing_stop_entry_shape(self):
        self.module.GLOBAL_HOOKS_FILE.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "hooks": {
                "Stop": [
                    {
                        "matcher": "workspace-1",
                        "hooks": [
                            {"type": "command", "command": str(self.module.INSTALLED_HOOK)},
                            {"type": "command", "command": "/usr/bin/other-hook"},
                        ],
                    }
                ]
            }
        }
        self.module.save_json(self.module.GLOBAL_HOOKS_FILE, payload)

        self.module.merge_hooks_json()
        updated = self.module.load_json(self.module.GLOBAL_HOOKS_FILE)

        stop_entry = updated["hooks"]["Stop"][0]
        self.assertEqual(stop_entry["matcher"], "workspace-1")
        self.assertEqual(len(stop_entry["hooks"]), 2)
        self.assertEqual(stop_entry["hooks"][1]["command"], "/usr/bin/other-hook")

    def test_merge_hooks_json_copies_backup_before_invalid_payload_is_rotated(self):
        self.module.GLOBAL_HOOKS_FILE.parent.mkdir(parents=True, exist_ok=True)
        self.module.GLOBAL_HOOKS_FILE.write_text("{not-json", encoding="utf-8")

        self.module.merge_hooks_json()

        self.assertTrue(self.module.GLOBAL_HOOKS_FILE.with_suffix(".json.bak").exists())
        rotated = list(self.module.GLOBAL_HOOKS_FILE.parent.glob("hooks.json.*.bak"))
        self.assertEqual(len(rotated), 1)

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

    def test_install_runtime_hook_rewrites_shebang_to_current_python(self):
        self.module.install_runtime_hook()

        installed = self.module.INSTALLED_HOOK.read_text(encoding="utf-8")
        self.assertTrue(installed.startswith(f"#!{self.module.sys.executable}\n"))
        self.assertNotEqual(self.module.INSTALLED_HOOK.stat().st_mode & 0o111, 0)

    def test_ensure_nmem_cli_runtime_ready_exits_when_missing(self):
        with mock.patch.object(self.module.importlib.util, "find_spec", return_value=None):
            with self.assertRaises(SystemExit) as exc:
                self.module.ensure_nmem_cli_runtime_ready()

        self.assertIn("nmem_cli", str(exc.exception))


class RefreshThreadTitleTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module("refresh_thread_titles", REFRESH_MODULE_PATH)

    def test_refresh_thread_restores_original_messages_on_failure(self):
        cli_mock = mock.Mock()
        cli_mock.api_post.side_effect = [RuntimeError("create failed"), None]

        with mock.patch.object(self.module, "cli", cli_mock):
            with self.assertRaises(RuntimeError):
                self.module.refresh_thread(
                    thread_id="codex-thread-1",
                    title="New title",
                    messages=[{"role": "user", "content": "new"}],
                    dry_run=False,
                    original_title="Old title",
                    original_messages=[{"role": "user", "content": "old"}],
                )

        self.assertEqual(cli_mock.api_delete.call_count, 1)
        self.assertEqual(cli_mock.api_post.call_count, 2)

        first_endpoint, first_payload = cli_mock.api_post.call_args_list[0].args
        self.assertEqual(first_endpoint, "/threads")
        self.assertEqual(first_payload["title"], "New title")

        restore_endpoint, restore_payload = cli_mock.api_post.call_args_list[1].args
        self.assertEqual(restore_endpoint, "/threads")
        self.assertEqual(restore_payload["title"], "Old title")
        self.assertEqual(
            restore_payload["messages"],
            [{"role": "user", "content": "old"}],
        )

    def test_build_thread_payload_filters_malformed_messages(self):
        payload = self.module.build_thread_payload(
            "thread-1",
            "Title",
            [
                {"role": "user", "content": "ok"},
                {"content": "missing-role"},
                "bad-entry",
                {"role": "assistant"},
            ],
        )

        self.assertEqual(
            payload["messages"],
            [
                {"role": "user", "content": "ok"},
                {"role": "assistant", "content": ""},
            ],
        )

    def test_main_configures_nmem_env_before_importing_modules(self):
        hook_module = mock.Mock()
        hook_module.derive_thread_title.return_value = "ignored"
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)

        with mock.patch.object(self.module, "load_hook_module", return_value=hook_module), \
             mock.patch.object(self.module, "ensure_nmem_modules", return_value=(mock.Mock(), mock.Mock())), \
             mock.patch.object(self.module, "iter_codex_rollouts", return_value=[]), \
             mock.patch("sys.argv", ["refresh_thread_titles.py"]):
            result = self.module.main()

        self.assertEqual(result, 0)
        hook_module.configure_nmem_env.assert_called_once_with()

    def test_main_counts_generic_refresh_errors(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        rollout_path = Path(temp_dir.name) / "rollout-1.jsonl"
        rollout_path.write_text("placeholder", encoding="utf-8")

        self.module.parse_codex_session_streaming = mock.Mock(
            return_value={
                "thread_id": "codex-thread-1",
                "messages": [{"role": "user", "content": "real request"}],
                "workspace": "/tmp/project",
            }
        )
        self.module.cli = mock.Mock()

        with mock.patch.object(self.module, "iter_codex_rollouts", return_value=[rollout_path]), \
             mock.patch.object(
                 self.module,
                 "get_thread",
                 return_value={"thread": {"title": f"{self.module.AGENTS_PREFIX}/tmp/project"}},
             ), \
             mock.patch.object(self.module, "refresh_thread", side_effect=RuntimeError("boom")), \
             mock.patch("sys.argv", ["refresh_thread_titles.py"]), \
             mock.patch("builtins.print") as print_mock:
            result = self.module.main()

        self.assertNotEqual(result, 0)
        printed_lines = [" ".join(str(arg) for arg in call.args) for call in print_mock.call_args_list]
        self.assertTrue(any("ERROR refresh codex-thread-1: boom" in line for line in printed_lines))
        self.assertTrue(any('"errors": 1' in line for line in printed_lines))


if __name__ == "__main__":
    unittest.main()
