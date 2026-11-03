"""Cross-host startup memory and optional session registration contracts."""
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]


class StartupMailboxTests(unittest.TestCase):
    def invoke(self, host, *, named=True, failure="disabled", source="startup", conflict=False):
        folder = ROOT / ("nowledge-mem-codex-plugin/hooks" if host == "codex" else "nowledge-mem-claude-code-plugin/scripts")
        script = folder / ("nmem-context.py" if host == "codex" else "nmem-hook-context.py")
        selection = {"scope": {"store_id": "store", "store_incarnation": "incarnation", "workspace_id": None, "space_id": "team-space"},
                     "address": {"agent_id": "reviewer", "identity_birth": "birth", "custodian_id": "owner", "attachment_id": "attachment", "attachment_generation": 1}}
        calls = []
        def run(argv, **kwargs):
            args = argv[2:]
            calls.append(args)
            if args[:3] == ["agents", "context", "show"]:
                reply = {"name": "reviewer", "configured": True, "selection": selection}
            elif "session-bootstrap" in args:
                if failure == "timeout":
                    raise subprocess.TimeoutExpired(argv, kwargs["timeout"])
                if failure != "ready":
                    return subprocess.CompletedProcess(argv, 1, json.dumps({"http_status": 503, "error_code": "mailbox_delivery_unavailable", "detail": "private-secret"}), "private-secret")
                reply = {"state": "active", "context": "reviewer", "resumed": source == "resume", "delivery_ready": True,
                         "receiving_capability": {"protocol_version": 2, "receive_mode": "auto", "recovery_owner": "server"},
                         "registration": {"address": {"schema_version": 2, "scope": selection["scope"], "agent": selection["address"], "session_id": "opaque", "registration_id": "registration", "mailbox_id": "mailbox", "binding_generation": 1},
                                          "state": "active", "registered_at": 10, "observed_at": 11, "lease_expires_at": 20, "closed_at": None}}
            elif "mailbox" in args:
                return subprocess.CompletedProcess(argv, 1, '{"error_code":"mailbox_delivery_unavailable"}', "")
            elif args[:2] == ["wm", "read"]:
                reply = {"exists": True, "content": "independent working memory"}
            else:
                return subprocess.CompletedProcess(argv, 1, '{}', "")
            return subprocess.CompletedProcess(argv, 0, json.dumps(reply), "")
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            env = {"CODEX_HOME": directory, "NMEM_BRIDGE_SESSION_MAILBOX": "1", "NMEM_AI_NOW_HOME": ""}
            if named:
                env["NMEM_AGENT_CONTEXT"] = "reviewer"
            if conflict:
                env["NMEM_SPACE"] = "different-space"
            stack.enter_context(mock.patch.dict(os.environ, env, clear=True))
            stack.enter_context(mock.patch.object(sys, "path", [str(folder), *sys.path]))
            spec = importlib.util.spec_from_file_location("startup_" + host, script)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            stack.enter_context(mock.patch.object(module.subprocess, "run", side_effect=run))
            stack.enter_context(mock.patch.object(module, "_nmem_command" if host == "codex" else "find_nmem", return_value="/pinned/nmem"))
            payload = {"hook_event_name": "SessionStart", "source": source, "session_id": "exact-native"}
            stack.enter_context(mock.patch.object(sys, "stdin", io.StringIO(json.dumps(payload))))
            output = stack.enter_context(mock.patch.object(sys, "stdout", io.StringIO()))
            if host == "codex":
                stack.enter_context(mock.patch.object(module, "_resume_context", return_value=("", False)))
                self.assertEqual(module.main(payload), 0)
            else:
                self.assertEqual(module.main(), 0)
            response = json.loads(output.getvalue())["hookSpecificOutput"]["additionalContext"]
        return response, calls

    def test_mailbox_failure_keeps_exact_space_working_memory(self):
        for host in ("codex", "claude-code"):
            for failure in ("disabled", "timeout", "refused"):
                for source in ("startup", "resume", "compact"):
                    with self.subTest(host=host, failure=failure, source=source):
                        context, calls = self.invoke(host, failure=failure, source=source)
                        self.assertIn("independent working memory", context)
                        self.assertIn(["wm", "read", "--space-id", "team-space"], calls)
                        self.assertFalse(any(args[0] == "context" for args in calls))
                        self.assertNotIn("private-secret", context)
                        self.assertNotIn("Backend session messaging is ready", context)
                        memory_index = calls.index(["wm", "read", "--space-id", "team-space"])
                        self.assertTrue(all(i > memory_index for i, args in enumerate(calls) if "session-bootstrap" in args))

    def test_no_identity_still_reads_working_memory_without_enrollment(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host):
                context, calls = self.invoke(host, named=False)
                self.assertIn("independent working memory", context)
                self.assertEqual(calls, [["wm", "read"]])
                self.assertIn("selection_required", context)

    def test_ambient_conflict_never_reads_another_space(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host):
                context, calls = self.invoke(host, conflict=True)
                self.assertNotIn("independent working memory", context)
                self.assertFalse(any(args[:2] == ["wm", "read"] for args in calls))
                self.assertFalse(any("session-bootstrap" in args for args in calls))

    def test_qualified_session_keeps_exact_host_and_original_resume_id(self):
        for host in ("codex", "claude-code"):
            for source in ("startup", "resume"):
                with self.subTest(host=host, source=source):
                    context, calls = self.invoke(host, source=source, failure="ready")
                    self.assertIn("independent working memory", context)
                    self.assertIn("Backend session messaging is ready", context)
                    self.assertIn(["--agent-context", "reviewer", "mailbox", "session-bootstrap", "--host", host, "--session-id", "exact-native"], calls)
                    self.assertIn('"native_session_id": "exact-native"', context)
                    self.assertNotIn("--host " + ("codex" if host == "claude-code" else "claude-code"), context)


if __name__ == "__main__":
    unittest.main()
