"""Local mailbox hook admission, not model-visible runtime acceptance."""

import importlib.util
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock


HOOKS = Path(__file__).resolve().parents[1] / "hooks"
import sys
sys.path.insert(0, str(HOOKS))
SPEC = importlib.util.spec_from_file_location("mailbox_context_hook", HOOKS / "nmem-context.py")
HOOK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOOK)


class MailboxContextTests(unittest.TestCase):
    def setUp(self):
        self.environment = mock.patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def status(self, **changes):
        value = {
            "name": "reviewer",
            "state": "usable",
            "validation": "live",
            "configured": True,
            "selection": {"scope": {"space_id": "default"}, "address": {"agent_id": "b"}},
        }
        value.update(changes)
        return value

    def invoke(self, event="SessionStart", result=None):
        output = io.StringIO()
        with mock.patch.object(HOOK, "_load_startup_context", return_value="") as load, \
             mock.patch.object(HOOK, "_resume_context", return_value=("", False)), \
             mock.patch.object(HOOK, "_nmem_command", return_value="nmem"), \
             mock.patch.object(HOOK.subprocess, "run", return_value=result) as run, \
             mock.patch.object(HOOK.sys, "stdout", output):
            self.assertEqual(HOOK.main({"hook_event_name": event, "agent_type": "worker"}), 0)
        self.load = load
        return json.loads(output.getvalue())["hookSpecificOutput"]["additionalContext"], run

    def test_disabled_has_no_mailbox_probe_or_guidance(self):
        context, run = self.invoke()
        run.assert_not_called()
        self.assertNotIn("Local mailbox", context)

    def test_live_context_installs_explicit_model_boundaries(self):
        os.environ["NMEM_AGENT_CONTEXT"] = "reviewer"
        result = subprocess.CompletedProcess([], 0, json.dumps(self.status()), "ignored-secret")
        context, run = self.invoke(result=result)
        self.assertIn("Local mailbox", context)
        self.assertIn("pre-completion", context)
        self.assertIn("stderr", context)
        self.assertIn("typed request", context)
        self.assertIn('"$NMEM_CLI_PATH"', context)
        self.assertIn("including ordinary commands", context)
        self.assertIn("login shells can reset PATH", context)
        self.assertNotIn("ignored-secret", context)
        self.assertEqual(run.call_args.args[0], ["nmem", "--json", "--agent-context", "reviewer", "mailbox", "status"])
        self.assertLessEqual(run.call_args.kwargs["timeout"], 3)
        self.load.assert_called_once_with(
            context_args=[],
            working_memory_args=["wm", "read", "--space-id", "default"],
            allow_file_fallback=False,
        )

    def test_live_space_identity_is_forwarded_without_normalization(self):
        os.environ["NMEM_AGENT_CONTEXT"] = "reviewer"
        for space in ("", " ", "Research Space", "\u7814\u53d1", "tag/one", "%2F", "\n", "e\u0301"):
            with self.subTest(space=space), mock.patch.dict(os.environ, {"NMEM_SPACE_ID": space}):
                status = self.status()
                status["selection"]["scope"]["space_id"] = space
                result = subprocess.CompletedProcess([], 0, json.dumps(status), "")
                context, _ = self.invoke(result=result)
                self.assertIn("pre-completion", context)
                self.load.assert_called_once_with(
                    context_args=[], working_memory_args=["wm", "read", "--space-id", space],
                    allow_file_fallback=False,
                )

    def test_nonlive_and_conflicting_status_never_install_operations(self):
        os.environ["NMEM_AGENT_CONTEXT"] = "reviewer"
        for changes in (
            {"state": "unverified", "validation": "unverified"},
            {"state": "invalidated", "reason": "selection_identity_mismatch"},
            {"name": "other"},
            {"validation": "unverified"},
            {"state": []},
            {"state": {}},
            {"selection": []},
            {"selection": {"scope": [], "address": {}}},
            {"http_status": 409, "error_code": "mailbox_attachment_stale"},
        ):
            with self.subTest(changes=changes):
                result = subprocess.CompletedProcess([], 0, json.dumps(self.status(**changes)), "")
                context, _ = self.invoke(result=result)
                self.assertNotIn("pre-completion", context)
                self.assertNotIn('"agent_id": "b"', context)
                self.load.assert_not_called()

    def test_mailbox_startup_never_runs_identity_ensure_context_command(self):
        result = subprocess.CompletedProcess([], 0, '{"content":"scoped briefing"}', "")
        with mock.patch.object(HOOK, "_nmem_command", return_value="nmem"), \
             mock.patch.object(HOOK.subprocess, "run", return_value=result) as run:
            self.assertEqual(HOOK._load_startup_context(
                context_args=[], working_memory_args=["wm", "read", "--space-id", "exact-id"],
                allow_file_fallback=False,
            ), "scoped briefing")
        self.assertEqual(run.call_args.args[0], ["nmem", "--json", "wm", "read", "--space-id", "exact-id"])
        self.assertEqual(run.call_count, 1)

    def test_refusal_preserves_only_typed_cause_and_status(self):
        os.environ["NMEM_AGENT_CONTEXT"] = "reviewer"
        result = subprocess.CompletedProcess([], 1, json.dumps({"http_status": 409, "error_code": "mailbox_attachment_stale", "detail": "secret"}), "secret-stderr")
        context, _ = self.invoke(result=result)
        self.assertIn("mailbox_attachment_stale", context)
        self.assertIn("409", context)
        self.assertNotIn("secret", context)
        self.assertNotIn("pre-completion", context)

    def test_subagent_and_prompt_never_probe_inherited_context(self):
        os.environ["NMEM_AGENT_CONTEXT"] = "reviewer"
        for event in ("SubagentStart", "UserPromptSubmit"):
            with self.subTest(event=event):
                context, run = self.invoke(event)
                run.assert_not_called()
                self.assertNotIn("pre-completion", context)

    def test_ambient_conflicts_never_publish_selected_identity(self):
        for key, value in (("NMEM_AGENT_ID", "other"), ("NMEM_SPACE", "other"), ("NMEM_SPACE_ID", "other"), ("NMEM_SPACE_ID", "DEFAULT"), ("NMEM_SPACE_ID", "default "), ("NMEM_SPACE_ID", ""), ("NMEM_HOST_AGENT_ID", "alias")):
            with self.subTest(key=key), mock.patch.dict(os.environ, {"NMEM_AGENT_CONTEXT": "reviewer", key: value}):
                result = subprocess.CompletedProcess([], 0, json.dumps(self.status()), "")
                context, _ = self.invoke(result=result)
                self.assertIn("ambient_selector_not_verified", context)
                self.assertNotIn("pre-completion", context)
                self.assertNotIn('"agent_id": "b"', context)
                self.load.assert_not_called()

    def test_missing_old_malformed_and_timeout_outputs_fail_open_without_operations(self):
        os.environ["NMEM_AGENT_CONTEXT"] = "reviewer"
        for result in (
            subprocess.CompletedProcess([], 1, '{"error":"unknown_command"}', "secret"),
            subprocess.CompletedProcess([], 0, "invalid JSON", "secret"),
            subprocess.CompletedProcess([], 0, "x" * (64 * 1024 + 1), "secret"),
        ):
            with self.subTest(result=result.returncode):
                context, _ = self.invoke(result=result)
                self.assertNotIn("pre-completion", context)
                self.assertNotIn("secret", context)
                self.load.assert_not_called()
        with mock.patch.object(HOOK, "_nmem_command", return_value="nmem"), \
             mock.patch.object(HOOK.subprocess, "run", side_effect=subprocess.TimeoutExpired("nmem", 3)):
            self.assertEqual(HOOK._mailbox_observation()["state"], "unverified")

    def test_isolated_or_nondefault_fallback_never_consults_home(self):
        for key, value in (("NMEM_AI_NOW_HOME", ""), ("NMEM_APP_DATA", "/isolated"), ("NMEM_CLI_CONFIG_DIR", "/isolated"), ("NMEM_SPACE", "other"), ("NMEM_SPACE_ID", "other"), ("NMEM_SPACE_ID", "DEFAULT"), ("NMEM_SPACE_ID", "default "), ("NMEM_SPACE_ID", "")):
            with self.subTest(key=key), mock.patch.dict(os.environ, {key: value}), \
                 mock.patch.object(HOOK, "_nmem_command", return_value=None), \
                 mock.patch.object(HOOK.Path, "home", side_effect=AssertionError("live home consulted")):
                self.assertEqual(HOOK._load_startup_context(), "")

    def test_custom_ai_now_home_never_reads_default_home(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            custom = root / "custom"
            custom.mkdir()
            (custom / "memory.md").write_text("isolated briefing", encoding="utf-8")
            os.environ["NMEM_AI_NOW_HOME"] = str(custom)
            with mock.patch.object(HOOK, "_nmem_command", return_value=None), \
                 mock.patch.object(HOOK.Path, "home", side_effect=AssertionError("live home consulted")):
                self.assertEqual(HOOK._load_startup_context(), "isolated briefing")
                (custom / "memory.md").unlink()
                self.assertEqual(HOOK._load_startup_context(), "")


if __name__ == "__main__":
    unittest.main()
