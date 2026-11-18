import importlib.util
import json
import os
from pathlib import Path
import shlex
from unittest import mock
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "bridge_notice_cache", Path(__file__).parents[1] / "nmem_bridge_notice.py"
)
NOTICE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NOTICE)


class CacheNoticeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.directory = self.root / "bridge-notices-v1"
        self.directory.mkdir(mode=0o700)
        self.now = 1_000_000
        self.key = "1" * 64
        self.target = {
            "host": "codex",
            "session_id": "actual-session",
            "native": False,
            "record": {"name": "approved", "revision": "a" * 64},
        }
        self.value = {
            "schema_version": 1,
            "config_fence": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "state": "fresh",
            "has_pending": True,
            "scan_incomplete": False,
            "host": "codex",
            "session_id": "actual-session",
            "context": "approved",
            "context_revision": "a" * 64,
            "binding_key": "b" * 64,
            "observer_binding_key": "b" * 64,
            "identity_key": "e" * 64,
            "change_token": "c" * 64,
            "mailbox_kind": "identity",
            "saved_ms": self.now,
            "expires_ms": self.now + 45_000,
        }
        self.save()

    def save(self):
        (self.directory / "enabled").write_text("{}")
        (self.directory / "subscriptions.json").write_text(
            json.dumps({self.key: self.target})
        )
        (self.directory / f"{self.key}.json").write_text(json.dumps(self.value))
        for path in self.directory.glob("*.json"):
            path.chmod(0o600)
        (self.directory / "enabled").chmod(0o600)

    def response(self, event="Stop", **extra):
        return NOTICE.response(
            {
                "hook_event_name": event,
                "session_id": "actual-session",
                "stop_hook_active": False,
                **extra,
            },
            host="codex",
            root=self.root,
            environ={},
            now_ms=self.now,
        )

    def test_model_hooks_share_tokens_and_keep_sessions_independent(self):
        self.assertEqual(self.response()["decision"], "block")
        self.assertEqual(self.response(), {})
        self.value["change_token"] = "d" * 64
        self.save()
        self.assertEqual(self.response()["decision"], "block")
        self.value["change_token"] = "c" * 64
        self.save()
        self.assertEqual(
            self.response(),
            {},
            "a previously seen token cannot remind again after a transient observation",
        )
        self.assertEqual(self.response("UserPromptSubmit"), {})
        self.value["change_token"] = "f" * 64
        self.save()
        self.assertIn(
            "additionalContext", self.response("UserPromptSubmit")["hookSpecificOutput"]
        )
        self.assertEqual(self.response("PostToolUse"), {})
        self.assertEqual(self.response(), {})
        self.assertEqual(self.response(stop_hook_active=True), {})
        self.assertEqual(self.response(session_id="another-session"), {})

    def test_ending_and_resuming_the_same_session_preserves_seen_tokens(self):
        self.assertEqual(self.response()["decision"], "block")
        (self.directory / "subscriptions.json").write_text("{}")
        self.assertEqual(self.response(), {})
        self.save()
        self.assertEqual(self.response(), {})
        self.value["change_token"] = "f" * 64
        self.save()
        self.assertEqual(self.response()["decision"], "block")

    def test_stale_unavailable_changed_binding_and_wrong_mailbox_kind_are_quiet(self):
        for change in [
            {"expires_ms": self.now},
            {"saved_ms": self.now + 1},
            {"state": "unavailable"},
            {"context_revision": "e" * 64},
            {"binding_key": "invalid"},
            {"mailbox_kind": "cloud-session"},
        ]:
            with self.subTest(change=change):
                original = self.value.copy()
                self.value.update(change)
                self.save()
                self.assertEqual(self.response(), {})
                self.value = original

    def test_missing_or_corrupt_consumer_does_not_hide_a_valid_session(self):
        broken = "0" * 64
        (self.directory / "subscriptions.json").write_text(
            json.dumps({broken: self.target, self.key: self.target})
        )
        (self.directory / f"{broken}.json").write_text("broken")
        self.assertEqual(self.response()["decision"], "block")

    def test_post_tool_use_rate_limit_does_not_consume_the_next_token(self):
        self.assertIn(
            "additionalContext", self.response("PostToolUse")["hookSpecificOutput"]
        )
        self.value["change_token"] = "d" * 64
        self.save()
        self.assertEqual(self.response("PostToolUse"), {})
        self.now += 120_000
        self.value.update(saved_ms=self.now, expires_ms=self.now + 45_000)
        self.save()
        self.assertIn(
            "additionalContext", self.response("PostToolUse")["hookSpecificOutput"]
        )

    @unittest.skipIf(
        os.name == "nt",
        "POSIX sentinel contract; Windows has a separate command regression",
    )
    def test_registered_launchers_start_no_interpreter_when_unconfigured(self):
        shims = self.root / "bin"
        shims.mkdir()
        counter = self.root / "interpreter-started"
        for executable in ("python3", "python", "py", "nmem"):
            shim = shims / executable
            shim.write_text(
                "#!/bin/sh\n: > " + shlex.quote(str(counter)) + "\nexit 77\n"
            )
            shim.chmod(0o700)
        empty = self.root / "unconfigured"
        for package, marker in [
            ("nowledge-mem-codex-plugin", "nmem-mailbox-stop.py"),
            ("nowledge-mem-claude-code-plugin", "nmem-hook-mailbox.py"),
        ]:
            hooks = json.loads((ROOT / package / "hooks/hooks.json").read_text())[
                "hooks"
            ]
            for event in ("Stop", "UserPromptSubmit", "PostToolUse", "SessionEnd"):
                entry = next(
                    hook
                    for group in hooks[event]
                    for hook in group["hooks"]
                    if marker in hook.get("command", "")
                )
                env = {
                    **os.environ,
                    "PATH": str(shims),
                    "NMEM_CLI_CONFIG_DIR": str(empty),
                }
                result = subprocess.run(
                    ["/bin/sh", "-c", entry["command"]],
                    env=env,
                    input="{}",
                    text=True,
                    capture_output=True,
                    timeout=1,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertFalse(counter.exists(), (package, event))

    def test_actual_configured_stop_launcher_never_calls_nmem(self):
        marker = self.root / "nmem-started"
        executable = self.root / "nmem"
        executable.write_text(
            "#!/bin/sh\n: > " + shlex.quote(str(marker)) + "\nexit 77\n"
        )
        executable.chmod(0o700)
        hooks = json.loads(
            (ROOT / "nowledge-mem-codex-plugin/hooks/hooks.json").read_text()
        )["hooks"]
        entry = next(
            hook
            for group in hooks["Stop"]
            for hook in group["hooks"]
            if "nmem-mailbox-stop.py" in hook.get("command", "")
        )
        import time

        self.value.update(
            saved_ms=int(time.time() * 1000),
            expires_ms=int(time.time() * 1000) + 45_000,
        )
        self.save()
        env = {
            **os.environ,
            "PLUGIN_ROOT": str(ROOT / "nowledge-mem-codex-plugin"),
            "NMEM_CLI_CONFIG_DIR": str(self.root),
            "NMEM_CLI_PATH": str(executable),
        }
        env.pop("NMEM_AGENT_CONTEXT", None)
        env.pop("GROK_PLUGIN_ROOT", None)
        event = {
            "hook_event_name": "Stop",
            "session_id": "actual-session",
            "stop_hook_active": False,
        }
        result = subprocess.run(
            (
                entry["commandWindows"]
                if os.name == "nt"
                else ["/bin/sh", "-c", entry["command"]]
            ),
            shell=os.name == "nt",
            env=env,
            input=json.dumps(event),
            text=True,
            capture_output=True,
            timeout=1,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["decision"], "block")
        self.assertFalse(marker.exists())

    @unittest.skipUnless(os.name == "nt", "Native cmd.exe contract")
    def test_windows_registration_gates_all_events_before_python(self):
        empty = self.root / "unconfigured"
        empty.mkdir()
        counter = self.root / "interpreter-calls"
        for name in ("py", "python", "python3"):
            (empty / (name + ".cmd")).write_text(
                '@echo started>>"%NMEM_TEST_INTERPRETER_CALLS%"\n@exit /b 0\n'
            )
        hooks = json.loads(
            (ROOT / "nowledge-mem-codex-plugin/hooks/hooks.json").read_text()
        )["hooks"]
        env = {
            **os.environ,
            "NMEM_CLI_CONFIG_DIR": str(empty),
            "PATH": str(empty),
            "NMEM_TEST_INTERPRETER_CALLS": str(counter),
        }
        for event in ("Stop", "UserPromptSubmit", "PostToolUse", "SessionEnd"):
            entry = next(
                hook
                for group in hooks[event]
                for hook in group["hooks"]
                if "nmem-mailbox-stop.py" in hook.get("commandWindows", "")
            )
            result = subprocess.run(
                entry["commandWindows"],
                shell=True,
                env=env,
                capture_output=True,
                text=True,
                timeout=2,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, "")
            self.assertFalse(counter.exists())

    def test_installed_fallback_and_package_share_cached_token(self):
        path = ROOT / "nowledge-mem-codex-plugin/scripts/install_hooks.py"
        spec = importlib.util.spec_from_file_location("cached_notice_installer", path)
        installer = importlib.util.module_from_spec(spec)
        with mock.patch.dict(
            os.environ, {"CODEX_HOME": str(self.root / "codex")}, clear=False
        ):
            spec.loader.exec_module(installer)
            installer.install_runtime_hook()
            installer.merge_hooks_json()
            installer.merge_hooks_json()
        commands = [
            hook["command"]
            for group in json.loads(installer.GLOBAL_HOOKS_FILE.read_text())["hooks"][
                "Stop"
            ]
            for hook in group["hooks"]
        ]
        self.assertEqual(
            sum("nowledge-mem-mailbox-stop.py" in command for command in commands), 1
        )
        import time

        self.value.update(
            saved_ms=int(time.time() * 1000),
            expires_ms=int(time.time() * 1000) + 45_000,
        )
        self.save()
        env = {**os.environ, "NMEM_CLI_CONFIG_DIR": str(self.root)}
        env.pop("NMEM_AGENT_CONTEXT", None)
        event = json.dumps(
            {
                "hook_event_name": "Stop",
                "session_id": "actual-session",
                "stop_hook_active": False,
            }
        )
        for script, expected in [
            (installer.HOOKS_DIR / "nowledge-mem-mailbox-stop.py", "block"),
            (ROOT / "nowledge-mem-codex-plugin/hooks/nmem-mailbox-stop.py", None),
        ]:
            result = subprocess.run(
                [sys.executable, str(script)],
                env=env,
                input=event,
                text=True,
                capture_output=True,
                timeout=2,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout).get("decision"), expected)


if __name__ == "__main__":
    unittest.main()
