"""The selected Thread is resolved before Codex receives its first prompt."""

import base64
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


HOOK = Path(__file__).resolve().parents[1] / "hooks" / "nmem-context.py"


class ThreadResumeTests(unittest.TestCase):
    def setUp(self):
        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        self.home = Path(home.name)
        spec = importlib.util.spec_from_file_location("resume_context", HOOK)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.target = {
            "thread_id": "精确 Thread ' $(false)",
            "thread_storage_id": "storage-id",
            "space_id": " Team ",
            "connection_id": "connection-id",
        }
        self.locator = base64.urlsafe_b64encode(
            json.dumps(self.target, ensure_ascii=False).encode()
        ).decode().rstrip("=")

    def run_hook(self, reply, *, prompt=None, session_id="native-1"):
        stdout = io.StringIO()
        payload = {"hook_event_name": "UserPromptSubmit", "session_id": session_id}
        payload["prompt"] = prompt if prompt is not None else (
            "NMEM_THREAD_RESUME_V1:" + self.locator + "\n\nContinue the work."
        )
        with mock.patch.object(self.module, "_nmem_command", return_value="nmem"), \
             mock.patch.object(self.module, "_run_nmem_json", return_value=reply) as run, \
             mock.patch.object(self.module.sys, "stdout", stdout), \
             mock.patch.object(self.module.Path, "home", return_value=self.home), \
             mock.patch.dict(self.module.os.environ, {}, clear=True):
            self.module.main(payload)
        return json.loads(stdout.getvalue()), run

    def test_exact_locator_is_bound_before_context_is_injected(self):
        response, run = self.run_hook({
            "binding": {"binding_id": "binding-1", "target": self.target},
            "context": {"context_text": "Verified prior conversation."},
        })
        self.assertTrue(response["continue"])
        self.assertIn("Verified prior conversation.", response["hookSpecificOutput"]["additionalContext"])
        self.assertEqual(run.call_args.args[1], [
            "t", "resume-bootstrap", "--from", "codex", "--session-id", "native-1",
            "--locator", self.locator,
        ])

    def test_failed_explicit_resume_blocks_prompt(self):
        response, _ = self.run_hook(None)
        self.assertEqual(response["decision"], "block")
        self.assertTrue(response["reason"])
        self.assertNotIn("hookSpecificOutput", response)

    def test_missing_native_identity_blocks_without_matching_latest(self):
        response, run = self.run_hook(None, session_id="")
        self.assertEqual(response["decision"], "block")
        run.assert_not_called()

    def test_unsupported_version_blocks_without_fuzzy_search(self):
        response, run = self.run_hook(None, prompt="NMEM_THREAD_RESUME_V2:abc")
        self.assertEqual(response["decision"], "block")
        run.assert_not_called()

    def test_normal_unbound_prompt_keeps_existing_guidance(self):
        response, _ = self.run_hook({"binding": None}, prompt="New independent work")
        self.assertTrue(response["continue"])
        self.assertIn("Nowledge", response["hookSpecificOutput"]["additionalContext"])

    def test_ordinary_context_remains_best_effort_with_an_older_cli(self):
        response, _ = self.run_hook(None, prompt="Independent new work")
        self.assertTrue(response["continue"])

    def test_server_reported_binding_error_blocks_even_without_local_locator(self):
        response, _ = self.run_hook({"binding": None, "resume_error": {"required": True}}, prompt="Continue native work")
        self.assertEqual(response["decision"], "block")

    def test_nonbinding_context_outage_does_not_block_independent_work(self):
        response, _ = self.run_hook({"binding": None, "resume_error": {"required": False}}, prompt="Independent new work")
        self.assertTrue(response["continue"])


if __name__ == "__main__":
    unittest.main()
