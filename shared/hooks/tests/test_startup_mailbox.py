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
    def invoke(self, host, *, named=True, failure="disabled", source="startup", conflict=False, native=True, mutate=None, switch=False, identity=None, explicit_space=None, event="SessionStart", pending_reference=None):
        folder = ROOT / ("nowledge-mem-codex-plugin/hooks" if host == "codex" else "nowledge-mem-claude-code-plugin/scripts")
        script = folder / ("nmem-context.py" if host == "codex" else "nmem-hook-context.py")
        selection = {"scope": {"store_id": "store", "store_incarnation": "incarnation", "workspace_id": None, "space_id": "team-space"},
                     "address": {"agent_id": "reviewer", "identity_birth": "birth", "custodian_id": "owner", "attachment_id": "attachment", "attachment_generation": 1}}
        if mutate:
            mutate(selection)
        calls = []
        shows = 0
        def run(argv, **kwargs):
            nonlocal shows
            args = argv[2:]
            calls.append(args)
            if args[:3] == ["agents", "context", "show"]:
                shows += 1
                current = json.loads(json.dumps(selection))
                if switch and shows > 1:
                    current["scope"]["space_id"] = "other-space"
                reply = {"name": "reviewer", "configured": True, "selection": current}
            elif "session-bootstrap" in args:
                if failure == "timeout":
                    raise subprocess.TimeoutExpired(argv, kwargs["timeout"])
                if failure != "ready":
                    return subprocess.CompletedProcess(argv, 1, json.dumps({"http_status": 503, "error_code": "mailbox_delivery_unavailable", "detail": "private-secret"}), "private-secret")
                reply = {"state": "active", "context": "reviewer", "resumed": source == "resume", "delivery_ready": True,
                         "receiving_capability": {"protocol_version": 2, "receive_mode": "auto", "recovery_owner": "server"},
                         "registration": {"address": {"schema_version": 2, "scope": selection["scope"], "agent": selection["address"], "session_id": "opaque", "registration_id": "registration", "mailbox_id": "mailbox", "binding_generation": 1},
                                          "state": "active", "registered_at": 10, "observed_at": 11, "lease_expires_at": 20, "closed_at": None}}
            elif "probe" in args:
                reply = {"schema_version": 1, "host": host, "session_id": "exact-native", "context": "reviewer", "mailbox_kind": "cloud-session"}
            elif args[:2] == ["agents", "show"]:
                return subprocess.CompletedProcess(argv, 1, '{}', "")
            elif "mailbox" in args:
                return subprocess.CompletedProcess(argv, 1, '{"error_code":"mailbox_delivery_unavailable"}', "")
            elif args[:2] == ["wm", "read"]:
                reply = {"exists": True, "content": "independent working memory"}
            else:
                return subprocess.CompletedProcess(argv, 1, '{}', "")
            return subprocess.CompletedProcess(argv, 0, json.dumps(reply), "")
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            env = {"CODEX_HOME": directory, "NMEM_BRIDGE_SESSION_MAILBOX": "1" if native else "0", "NMEM_AI_NOW_HOME": ""}
            if named:
                env["NMEM_AGENT_CONTEXT"] = "reviewer"
            if identity:
                env["NMEM_AGENT_ID"] = identity
            if explicit_space:
                env["NMEM_SPACE"] = explicit_space
            if conflict:
                env["NMEM_SPACE"] = "different-space"
            stack.enter_context(mock.patch.dict(os.environ, env, clear=True))
            stack.enter_context(mock.patch.object(sys, "path", [str(folder), *sys.path]))
            spec = importlib.util.spec_from_file_location("startup_" + host, script)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            stack.enter_context(mock.patch.object(module.subprocess, "run", side_effect=run))
            stack.enter_context(mock.patch.object(module, "_nmem_command" if host == "codex" else "find_nmem", return_value="/pinned/nmem"))
            payload = {"hook_event_name": event, "source": source, "session_id": "exact-native", "agent_type": "researcher"}
            stack.enter_context(mock.patch.object(sys, "stdin", io.StringIO(json.dumps(payload))))
            output = stack.enter_context(mock.patch.object(sys, "stdout", io.StringIO()))
            if host == "codex":
                stack.enter_context(mock.patch.object(module, "_resume_context", return_value=("", False)))
                if event == "SubagentStart":
                    stack.enter_context(mock.patch.object(module, "_pending_startup", return_value=(True, "")))
                    stack.enter_context(mock.patch.object(module, "_read_pending", return_value=("present", {"context_reference": pending_reference, "context_name": "reviewer", "space_id": "team-space"})))
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

    def test_legacy_mailbox_failure_still_injects_memory(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host):
                context, calls = self.invoke(host, native=False)
                self.assertIn("independent working memory", context)
                self.assertIn(["wm", "read", "--space-id", "team-space"], calls)
                self.assertFalse(any(args[0] == "context" or "session-bootstrap" in args for args in calls))

    def test_malformed_selection_never_falls_back_or_registers(self):
        mutations = [("scope", "store_id", None), ("scope", "space_id", "bad\0id"),
                     ("scope", "space_id", "\ud800"), ("scope", "space_id", {}),
                     ("address", "identity_birth", None),
                     *[("address", "attachment_generation", value) for value in (True, 0, -1, 1.5, 1 << 53)]]
        for host in ("codex", "claude-code"):
            for part, key, value in mutations:
                with self.subTest(host=host, part=part, key=key, value=repr(value)):
                    def mutate(selection):
                        if value is None:
                            del selection[part][key]
                        else:
                            selection[part][key] = value
                    context, calls = self.invoke(host, mutate=mutate)
                    self.assertNotIn("independent working memory", context)
                    self.assertNotIn("Backend session messaging is ready", context)
                    self.assertFalse(any(args[:2] == ["wm", "read"] or "session-bootstrap" in args or args[0] == "context" for args in calls))

    def test_context_switch_after_memory_cannot_register_another_lane(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host):
                context, calls = self.invoke(host, failure="ready", switch=True)
                self.assertIn("independent working memory", context)
                self.assertNotIn("Backend session messaging is ready", context)
                self.assertIn("selection_changed", context)
                self.assertFalse(any("session-bootstrap" in args for args in calls))

    def test_resume_preserves_existing_cloud_transport_without_bootstrap(self):
        for host in ("codex", "claude-code"):
            for source in ("resume", "compact"):
                with self.subTest(host=host, source=source):
                    context, calls = self.invoke(host, source=source)
                    self.assertIn("independent working memory", context)
                    self.assertIn("original_session_preserved", context)
                    self.assertFalse(any("session-bootstrap" in args or "cloud-session-bootstrap" in args for args in calls))
                    self.assertIn(["--agent-context", "reviewer", "mailbox", "probe", "--host", host, "--session-id", "exact-native", "--native-session"], calls)

    def test_explicit_identity_without_mailbox_never_ensures_a_profile(self):
        for host in ("codex", "claude-code"):
            for space in (None, "team-space"):
                with self.subTest(host=host, space=space):
                    context, calls = self.invoke(host, named=False, native=False, identity="not-created", explicit_space=space)
                    self.assertFalse(any(args[0] == "context" or "enroll" in args or "session-bootstrap" in args for args in calls))
                    if space:
                        self.assertIn("independent working memory", context)
                        self.assertEqual(calls, [["wm", "read", "--space", space]])
                    else:
                        self.assertNotIn("independent working memory", context)
                        self.assertEqual(calls, [["agents", "show", "not-created"]])

    def test_selected_pending_subagent_memory_does_not_require_a_mailbox(self):
        context, calls = self.invoke("codex", native=False, event="SubagentStart")
        self.assertIn("independent working memory", context)
        self.assertIn(["wm", "read", "--space-id", "team-space"], calls)
        self.assertFalse(any("mailbox" in args for args in calls))
        context, calls = self.invoke("codex", native=False, event="SubagentStart", pending_reference={"original": "pending"})
        self.assertNotIn("independent working memory", context)
        self.assertFalse(any(args[:2] == ["wm", "read"] for args in calls))

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
            for source in ("startup",):
                with self.subTest(host=host, source=source):
                    context, calls = self.invoke(host, source=source, failure="ready")
                    self.assertIn("independent working memory", context)
                    self.assertIn("Backend session messaging is ready", context)
                    self.assertIn(["--agent-context", "reviewer", "mailbox", "session-bootstrap", "--host", host, "--session-id", "exact-native"], calls)
                    self.assertIn('"native_session_id": "exact-native"', context)
                    self.assertNotIn("--host " + ("codex" if host == "claude-code" else "claude-code"), context)


if __name__ == "__main__":
    unittest.main()
