import json
import sys
import shutil
import subprocess
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_bridge_notices import bridge_notice_hint, bridge_session_hint
from agent_bridge_startup import create_bridge_startup_hint


class GenericBridgeNoticeTests(unittest.TestCase):
    def test_opaque_session_is_correlated_without_a_subprocess(self):
        with mock.patch("nmem_bridge_notice.response", return_value={"hookSpecificOutput": {"additionalContext": "Mail available."}}) as response, mock.patch("agent_bridge_notices.subprocess.run") as runner:
            session = 'session; echo "wrong"'
            hint = bridge_notice_hint("pi", session, {"NMEM_CLI_PATH": "C:/fixture/nmem.cmd"})
            self.assertEqual(hint, "Mail available.")
            response.assert_called_once_with({"hook_event_name": "UserPromptSubmit", "session_id": session}, host="pi", environ={"NMEM_CLI_PATH": "C:/fixture/nmem.cmd"})
            runner.assert_not_called()

    def test_missing_session_never_consumes_a_notice(self):
        with mock.patch("nmem_bridge_notice.response") as response:
            for session in [None, "", " ", "unknown", "bad\nvalue", "\ud800", "x" * 1025]:
                self.assertEqual(bridge_notice_hint("pi", session, {}), "")
                self.assertEqual(bridge_session_hint("pi", session), "")
            response.assert_not_called()

    def test_active_turn_checks_continue_after_startup_hint(self):
        hint = create_bridge_startup_hint("hermes")
        env = {"NMEM_BRIDGE_INBOX_ON_START": "1", "NMEM_AGENT_CONTEXT": "approved"}
        with mock.patch("agent_bridge_startup.bridge_notice_hint", side_effect=["", "Fresh local notice", ""]) as check:
            first = hint("real-session", env)
            self.assertIn("notices subscribe", first)
            self.assertIn('"host": "hermes"', first)
            self.assertEqual(hint("real-session", env), "Fresh local notice")
            self.assertEqual(hint("real-session", env), "")
            self.assertEqual(check.call_count, 3)

    def test_unconfigured_startup_does_not_offer_subscription(self):
        hint = create_bridge_startup_hint("pi")
        with mock.patch("agent_bridge_startup.bridge_notice_hint", return_value="Existing explicit notice"):
            self.assertEqual(hint("real-session", {}), "Existing explicit notice")


    def test_cleanup_uses_literal_session_and_clears_ambient_selectors(self):
        from agent_bridge_notices import close_bridge_session
        session = 'opaque; "quoted" session'
        with mock.patch.dict("os.environ", {"NMEM_CLI_PATH": "/fixture/nmem", "NMEM_AGENT_CONTEXT": "unrelated", "NMEM_SPACE": "other"}), mock.patch("agent_bridge_notices.subprocess.run") as run:
            close_bridge_session("copilot-cli", session)
            args, options = run.call_args
            self.assertEqual(args[0], ["/fixture/nmem", "--json", "bridge", "notices", "unsubscribe", "--host=copilot-cli", "--session-id=" + session, "--ended"])
            self.assertNotIn("NMEM_AGENT_CONTEXT", options["env"])
            self.assertNotIn("NMEM_SPACE", options["env"])
            self.assertEqual(options["timeout"], 0.5)

    def test_windows_cleanup_quotes_batch_path_and_rejects_expansion(self):
        from agent_bridge_notices import _cleanup_command
        env = {"NMEM_CLI_PATH": r"C:\Program Files\nmem.cmd", "SystemRoot": r"C:\Windows"}
        with mock.patch("agent_bridge_notices.os.name", "nt"):
            command = _cleanup_command(['--session-id=opaque & "quoted"'], env)
            self.assertEqual(command, '\"C:\\Windows\\System32\\cmd.exe\" /d /s /c \"\"C:\\Program Files\\nmem.cmd\" \"--session-id=opaque & \"\"quoted\"\"\"\"')
            with self.assertRaises(ValueError):
                _cleanup_command(["--session-id=%PATH%"], env)

    def test_codebuddy_adapter_delivers_prompt_hints_and_closes_real_sessions(self):
        import contextlib
        import io
        import runpy
        script = Path(__file__).resolve().parents[1] / "bridge-host-hook.py"
        for host in ["codebuddy"]:
            for event in ["UserPromptSubmit", "SessionEnd"]:
                with self.subTest(host=host, event=event):
                    payload = io.TextIOWrapper(io.BytesIO(json.dumps({"hook_event_name":event, "session_id":"actual-session"}).encode()))
                    output = io.StringIO()
                    with mock.patch("sys.argv", [str(script), host]), mock.patch("sys.stdin", payload), contextlib.redirect_stdout(output), mock.patch("agent_bridge_notices.bridge_notice_hint", return_value="Synthetic mail") as notice, mock.patch("agent_bridge_notices.close_bridge_session") as close:
                        runpy.run_path(str(script), run_name="__main__")
                    result = json.loads(output.getvalue())
                    if event == "UserPromptSubmit":
                        notice.assert_called_once_with(host, "actual-session")
                        close.assert_not_called()
                        self.assertEqual(result["hookSpecificOutput"]["additionalContext"], "Synthetic mail")
                    else:
                        close.assert_called_once_with(host, "actual-session")
                        notice.assert_not_called()
                        self.assertEqual(result, {})

    @unittest.skipUnless(sys.platform != "win32", "POSIX launcher fixture")
    def test_codebuddy_selects_interpreter_before_consuming_input(self):
        import os
        import shlex
        import tempfile
        script = Path(__file__).resolve().parents[1] / "bridge-host-hook.sh"
        for candidate in ["python3", "python", "py"]:
            with self.subTest(candidate=candidate), tempfile.TemporaryDirectory() as owned:
                root = Path(owned)
                for name in ["python3", "python", "py"]:
                    executable = root / name
                    if name == candidate:
                        source = "#!/bin/sh\n" + ("shift\n" if name == "py" else "") + "exec " + shlex.quote(sys.executable) + ' "$@"\n'
                    else:
                        source = "#!/bin/sh\nexit 1\n"
                    executable.write_text(source)
                    executable.chmod(0o700)
                env = dict(os.environ, PATH=str(root), NMEM_BRIDGE_INBOX_ON_START="1", NMEM_AGENT_CONTEXT="fixture")
                result = subprocess.run(["/bin/sh", str(script)], env=env, input=json.dumps({"hook_event_name":"SessionStart", "session_id":"actual-session"}), text=True, capture_output=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("actual-session", json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"])

    @unittest.skipUnless(shutil.which("node"), "Node is required for JavaScript adapters")
    def test_javascript_notice_contract(self):
        result = subprocess.run(["node", "--test", str(Path(__file__).with_name("agent-bridge-notices.test.mjs"))], capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
