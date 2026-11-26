"""Verify the packaged startup hint and on-host adapters without mailbox I/O."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
HELPERS = ROOT / "shared" / "hooks"
sys.path.insert(0, str(HELPERS))
from agent_bridge_startup import bridge_startup_hint, create_bridge_startup_hint
from agent_bridge_notices import bridge_session_hint

OPTED_IN = {"NMEM_BRIDGE_INBOX_ON_START": "1", "NMEM_AGENT_CONTEXT": "private-role"}


class AgentBridgeStartupTests(unittest.TestCase):
    def test_requires_opt_in_and_named_context(self):
        self.assertEqual(bridge_startup_hint({}), "")
        self.assertEqual(bridge_startup_hint({"NMEM_AGENT_CONTEXT": "role"}), "")
        self.assertEqual(bridge_startup_hint({**OPTED_IN, "NMEM_AGENT_CONTEXT": " \t "}), "")
        hint = bridge_startup_hint(OPTED_IN)
        self.assertNotIn("private-role", hint)

    def test_hint_uses_the_scoped_bridge_cli_contract(self):
        hint = bridge_startup_hint(OPTED_IN)
        for token in (
            "endpoint.address", "endpoint.scope.space_id", "top-level identity and space_id",
            "omit --enable", "--resolved-space-id", "without --wait or --watch",
            "messages[].message", "Resume only its returned operation",
        ):
            with self.subTest(token=token):
                self.assertIn(token, hint)

    def test_only_one_hint_per_live_session(self):
        for_session = create_bridge_startup_hint()
        self.assertEqual(for_session("first", {}), "")
        self.assertEqual(for_session("", OPTED_IN), "")
        self.assertEqual(for_session("first", OPTED_IN), bridge_startup_hint(OPTED_IN))
        self.assertEqual(for_session("first", OPTED_IN), "")
        self.assertEqual(for_session("second", OPTED_IN), bridge_startup_hint(OPTED_IN))

    @unittest.skipUnless(shutil.which("node"), "Node is needed to verify both hook runtimes")
    def test_js_and_python_use_the_same_hint(self):
        path = (HELPERS / "agent-bridge-startup.mjs").as_uri()
        program = (
            f"import {{ bridgeStartupHint, createBridgeStartupHint }} from {json.dumps(path)};"
            f"const env = {json.dumps(OPTED_IN)};"
            "const hint = createBridgeStartupHint();"
            "process.stdout.write(JSON.stringify([bridgeStartupHint(env), hint('one', env), hint('one', env)]));"
        )
        values = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", program], text=True))
        expected = bridge_startup_hint(OPTED_IN)
        self.assertEqual(values, [expected, expected, ""])

    @unittest.skipIf(os.name == "nt", "these two host adapters use POSIX hook syntax")
    def test_shell_hooks_inject_only_static_guidance(self):
        for host in ("codebuddy", "droid"):
            config = json.loads((ROOT / f"nowledge-mem-{host}-plugin/hooks/hooks.json").read_text())
            startup = next(hook["command"] for group in config["hooks"]["SessionStart"] for hook in group["hooks"] if "<nowledge_bridge_startup>" in hook["command"])
            for environment in ({}, OPTED_IN, {**OPTED_IN, "NMEM_AGENT_CONTEXT": "   "}):
                with self.subTest(host=host, enabled=bool(bridge_startup_hint(environment))):
                    result = subprocess.check_output(["sh", "-c", startup], env=environment, text=True).rstrip()
                    self.assertEqual(result, bridge_startup_hint(environment))

    @unittest.skipIf(os.name == "nt", "the optional Devin hook uses POSIX shell syntax")
    def test_devin_local_hook_outputs_session_context_json(self):
        config = json.loads((ROOT / "nowledge-mem-devin-plugin/hooks/bridge-local.json").read_text())
        startup = config["SessionStart"][0]["hooks"][0]["command"]
        self.assertEqual(subprocess.check_output(["sh", "-c", startup], env={}, text=True), "")
        response = subprocess.check_output(["sh", "-c", startup], env=OPTED_IN, text=True)
        self.assertEqual(json.loads(response)["hookSpecificOutput"], {
            "hookEventName": "SessionStart",
            "additionalContext": bridge_startup_hint(OPTED_IN),
        })

    @unittest.skipUnless(shutil.which("node"), "Node is needed for the MiMo Code file hook")
    def test_mimo_only_transforms_the_first_eligible_model_request(self):
        path = (HELPERS / "adapters" / "mimo-code" / "nowledge-bridge.js").as_uri()
        program = f"import hooks from {json.dumps(path)};\n" + """
const transform = hooks['experimental.chat.messages.transform'];
const original = { info: { role: 'user', sessionID: 'one' }, parts: [{ type: 'text', text: 'Hello' }] };
const synthetic = { ...original, parts: [{ type: 'text', text: 'Internal', synthetic: true }] };
const second = { ...original, info: { ...original.info, sessionID: 'two' } };
const project = async message => {
  const output = { messages: [message] };
  await transform({}, output);
  return output.messages[0].parts[0].text;
};
process.stdout.write(JSON.stringify([
  await project(synthetic), await project(original), await project(original),
  await project(second), original.parts[0].text,
]));
"""
        env = {**os.environ, **OPTED_IN}
        values = json.loads(subprocess.check_output(
            ["node", "--input-type=module", "-e", program], env=env, text=True,
        ))
        expected = bridge_startup_hint(OPTED_IN)
        self.assertEqual(values[0], "Internal")
        self.assertIn(expected, values[1])
        self.assertEqual(values[2], "Hello")
        self.assertIn(expected, values[3])
        self.assertEqual(values[4], "Hello")

    @unittest.skipUnless(shutil.which("node"), "Node is needed for the MiniMax Code hook")
    def test_minimax_local_plugin_emits_model_context(self):
        directory = HELPERS / "adapters" / "minimax-code"
        package = json.loads((directory / ".claude-plugin" / "plugin.json").read_text())
        hook = package["hooks"]["SessionStart"][0]
        self.assertEqual(hook["matcher"], "startup|resume")
        self.assertEqual(hook["hooks"][0]["command"], 'node "${PLUGIN_ROOT}/session-start.mjs"')
        command = ["node", str(directory / "session-start.mjs")]
        response = subprocess.check_output(command, env=os.environ.copy(), text=True)
        result = json.loads(response)["hookSpecificOutput"]
        self.assertEqual(result["hookEventName"], "SessionStart")
        self.assertTrue(result["additionalContext"].startswith("Check the agent shell for NMEM_BRIDGE_INBOX_ON_START=1"))
        self.assertIn("Skip the inbox if either is missing", result["additionalContext"])
        self.assertTrue(result["additionalContext"].endswith(bridge_startup_hint(OPTED_IN)))

    def test_kimi_prompt_hook_uses_a_distinct_session_and_host(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {**os.environ, **OPTED_IN, "HOME": directory, "USERPROFILE": directory}
            def invoke(host, session, event="UserPromptSubmit"):
                return subprocess.check_output(
                    [sys.executable, str(HELPERS / "kimi-bridge-startup.py"), host],
                    env=env, text=True, input=json.dumps({"hook_event_name": event, "session_id": session}),
                ).rstrip()

            expected = bridge_startup_hint(OPTED_IN)
            self.assertEqual(invoke("kimi-code", "one", "SessionStart"), "")
            self.assertEqual(invoke("kimi-code", ""), "")
            self.assertEqual(invoke("kimi-code", "one"), expected + "\n" + bridge_session_hint("kimi-code", "one"))
            self.assertEqual(invoke("kimi-code", "one"), "")
            self.assertEqual(invoke("kimi-work", "one"), expected + "\n" + bridge_session_hint("kimi-work", "one"))


if __name__ == "__main__":
    unittest.main()
