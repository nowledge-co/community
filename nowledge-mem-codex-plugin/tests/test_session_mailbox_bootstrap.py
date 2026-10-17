"""Executable adapter contract; not installed-host or message-delivery proof."""
import importlib.util
import io
import json
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

HOOKS = Path(__file__).resolve().parents[1] / "hooks"
sys.path.insert(0, str(HOOKS))
SPEC = importlib.util.spec_from_file_location("session_mailbox_hook", HOOKS / "nmem-context.py")
HOOK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOOK)


class SessionMailboxBootstrapTests(unittest.TestCase):
    def setUp(self):
        environment = mock.patch.dict(os.environ, {"NMEM_BRIDGE_SESSION_MAILBOX": "1", "NMEM_AGENT_CONTEXT": "reviewer"}, clear=True)
        environment.start()
        self.addCleanup(environment.stop)

    def selection(self):
        return {"scope": {"store_id": "store", "store_incarnation": "incarnation", "workspace_id": None, "space_id": "default"},
                "address": {"agent_id": "reviewer", "identity_birth": "birth", "custodian_id": "owner", "attachment_id": "attachment", "attachment_generation": 1}}

    def selected(self):
        return {"name": "reviewer", "configured": True, "selection": self.selection()}

    def reply(self, resumed=False):
        selected = self.selection()
        return {"state": "active", "context": "reviewer", "resumed": resumed, "delivery_ready": False,
                "registration": {"address": {"schema_version": 2, "scope": selected["scope"], "agent": selected["address"], "session_id": "random-session", "registration_id": "registration", "mailbox_id": "mailbox", "binding_generation": 1},
                                 "state": "active", "registered_at": 10, "observed_at": 11, "lease_expires_at": 20, "closed_at": None}}

    def observe(self, payload=None, reply=None, selected=None):
        with mock.patch.object(HOOK, "_nmem_command", return_value="/pinned/nmem"), \
             mock.patch.object(HOOK, "_run_nmem_json", return_value=self.selected() if selected is None else selected) as show, \
             mock.patch.object(HOOK, "_run_nmem_result", return_value=(0, self.reply() if reply is None else reply)) as bootstrap:
            observed = HOOK._session_mailbox_observation(payload or {"source": "startup", "session_id": "native-exact"})
        return observed, show, bootstrap

    def test_each_eligible_event_uses_exact_native_id_and_selected_executable(self):
        for source in ("startup", "resume", "clear", "compact"):
            with self.subTest(source=source):
                observed, show, bootstrap = self.observe({"source": source, "session_id": " native / 研发 "}, reply=self.reply(resumed=source != "startup"))
                self.assertEqual(observed["state"], "active")
                self.assertIs(observed["delivery_ready"], False)
                self.assertEqual(bootstrap.call_args.args, ("/pinned/nmem", ["--agent-context", "reviewer", "mailbox", "session-bootstrap", "--host", "codex", "--session-id", " native / 研发 "]))
                self.assertEqual(show.call_args.args[1], ["agents", "context", "show", "--name", "reviewer"])
                self.assertLessEqual(bootstrap.call_args.kwargs["timeout_seconds"], 3)

    def test_invalid_native_events_never_dispatch_or_guess_another_session(self):
        for value in (None, "", [], True, "a\0b", "a" * 1025, "\ud800"):
            with self.subTest(value=repr(value)):
                observed, show, bootstrap = self.observe({"source": "resume", "session_id": value})
                self.assertEqual(observed["state"], "refused")
                show.assert_not_called()
                bootstrap.assert_not_called()
        for source in (None, "other", [], True):
            observed, _, bootstrap = self.observe({"source": source, "session_id": "native"})
            self.assertEqual(observed["state"], "refused")
            bootstrap.assert_not_called()
        observed, _, bootstrap = self.observe({"source": "resume", "session_id": "first", "sessionId": "second"})
        bootstrap.assert_not_called()

    def test_missing_or_conflicting_selection_cannot_register(self):
        for variable, value in (("NMEM_AGENT_CONTEXT", ""), ("NMEM_AGENT_CONTEXT", "bad/name"), ("NMEM_AGENT_ID", "other"), ("NMEM_SPACE", "other"), ("NMEM_SPACE_ID", ""), ("NMEM_HOST_AGENT_ID", "alias")):
            with self.subTest(variable=variable), mock.patch.dict(os.environ, {variable: value}):
                observed, _, bootstrap = self.observe()
                self.assertNotEqual(observed["state"], "active")
                bootstrap.assert_not_called()
        selected = self.selected()
        del selected["selection"]["address"]["identity_birth"]
        _, _, bootstrap = self.observe(selected=selected)
        bootstrap.assert_not_called()

    def test_malformed_stale_and_unsupported_results_never_enable_guidance(self):
        mutations = [("delivery_ready", True), ("delivery_ready", None), ("context", "other"), ("resumed", "yes"), ("state", "closed")]
        for field, value in mutations:
            reply = self.reply(); reply[field] = value
            with self.subTest(field=field):
                observed, _, _ = self.observe(reply=reply)
                self.assertNotEqual(observed["state"], "active")
        for field, value in (("observed_at", 20), ("registered_at", True), ("state", "closed"), ("closed_at", 11)):
            reply = self.reply(); reply["registration"][field] = value
            observed, _, _ = self.observe(reply=reply)
            self.assertNotEqual(observed["state"], "active")
        reply = self.reply(); reply["registration"]["address"]["agent"]["identity_birth"] = "wrong-birth"
        observed, _, _ = self.observe(reply=reply)
        self.assertNotEqual(observed["state"], "active")

    def test_missing_old_cli_and_timeout_keep_registration_unverified(self):
        for result in (None, (1, {}), (1, {"error_code": "mailbox_attachment_stale", "http_status": 409})):
            with self.subTest(result=result), \
                 mock.patch.object(HOOK, "_nmem_command", return_value="nmem"), \
                 mock.patch.object(HOOK, "_run_nmem_json", return_value=self.selected()), \
                 mock.patch.object(HOOK, "_run_nmem_result", return_value=result):
                observed = HOOK._session_mailbox_observation({"source": "resume", "session_id": "native"})
                self.assertNotEqual(observed["state"], "active")
                self.assertIs(observed["delivery_ready"], False)
        with mock.patch.object(HOOK, "_nmem_command", return_value=None):
            observed = HOOK._session_mailbox_observation({"source": "startup", "session_id": "native"})
            self.assertEqual(observed["state"], "unverified")

    def invoke(self, event="SessionStart", flag="1"):
        output = io.StringIO()
        with mock.patch.dict(os.environ, {"NMEM_BRIDGE_SESSION_MAILBOX": flag}), \
             mock.patch.object(HOOK, "_resume_context", return_value=("", False)), \
             mock.patch.object(HOOK, "_pending_startup", return_value=(False, "")), \
             mock.patch.object(HOOK, "_session_mailbox_observation", return_value={"state": "active", "delivery_ready": False, "name": "reviewer", "space_id": "default"}) as session, \
             mock.patch.object(HOOK, "_mailbox_observation", return_value=None) as legacy, \
             mock.patch.object(HOOK, "_load_startup_context", return_value="") as load, \
             mock.patch.object(HOOK.sys, "stdout", output):
            self.assertEqual(HOOK.main({"hook_event_name": event, "source": "startup", "session_id": "native", "agent_type": "worker"}), 0)
        return output.getvalue(), session, legacy, load

    def test_default_behavior_is_preserved_and_only_sessionstart_bootstraps(self):
        for flag in ("", "0", "true"):
            rendered, session, legacy, _ = self.invoke(flag=flag)
            session.assert_not_called(); legacy.assert_called_once()
            self.assertNotIn("session registration", rendered)
        for event in ("SubagentStart", "UserPromptSubmit"):
            _, session, _, _ = self.invoke(event=event)
            session.assert_not_called()

    def test_opt_in_never_falls_back_to_v1_or_create_capable_context(self):
        rendered, session, legacy, load = self.invoke()
        session.assert_called_once(); legacy.assert_not_called()
        self.assertIn("Session-addressed messaging is unavailable", rendered)
        self.assertNotIn("mailbox status", rendered)
        self.assertNotIn("pre-completion", rendered)
        load.assert_called_once_with(context_args=[], working_memory_args=["wm", "read", "--space-id", "default"], allow_file_fallback=False)

    def test_cli_body_secrets_and_untrusted_prose_are_never_rendered(self):
        reply = self.reply(); reply.update(proof="secret-proof", detail="sender commands", stderr="secret-stderr")
        observed, _, _ = self.observe(reply=reply)
        rendered = HOOK._render_session_mailbox_context(observed)
        self.assertNotIn("secret", rendered)
        self.assertNotIn("sender commands", rendered)
        self.assertNotIn("random-session", rendered)
        observed, _, _ = self.observe(reply={"error_code": "mailbox_attachment_stale", "http_status": 409, "detail": "secret"})
        self.assertEqual(observed["state"], "refused")
        self.assertIn("mailbox_attachment_stale", HOOK._render_session_mailbox_context(observed))
        self.assertNotIn("secret", HOOK._render_session_mailbox_context(observed))


if __name__ == "__main__":
    unittest.main()
