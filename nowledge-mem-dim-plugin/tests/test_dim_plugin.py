"""Tests for the Nowledge Mem plugin for Dim.

Run from the repository root:

    python -m unittest discover -s nowledge-mem-dim-plugin/tests -v
"""

import json
import os
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

PACKAGE = Path(__file__).resolve().parent.parent
SCRIPTS = PACKAGE / "scripts"
FIXTURES = Path(__file__).resolve().parent / "fixtures"

ISOLATED_TMP = tempfile.mkdtemp(prefix="dim-plugin-tests-")
os.environ["TMPDIR"] = ISOLATED_TMP
tempfile.tempdir = None
for name in list(os.environ):
    if name.startswith("NMEM_"):
        del os.environ[name]

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import nmem_capture  # noqa: E402
import nmem_common  # noqa: E402
import nmem_hook  # noqa: E402


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_executable(path, text):
    path.write_text(text, encoding="utf-8")
    path.chmod(0o755)
    return path


class ManifestTests(unittest.TestCase):
    def test_manifest_names_only_dim_fields_and_real_paths(self):
        manifest = load(PACKAGE / "dim-plugin.json")
        self.assertEqual(set(manifest), {"name", "description", "skills", "mcp", "hooks"})
        self.assertEqual(manifest["name"], "nowledge-mem")
        for key in ("skills", "mcp", "hooks"):
            self.assertTrue((PACKAGE / manifest[key]).exists(), key)

    def test_hooks_cover_three_events_with_their_budgets(self):
        hooks = load(PACKAGE / "hooks.json")["hooks"]
        self.assertEqual(set(hooks), {"SessionStart", "UserPromptSubmit", "Stop"})
        self.assertEqual(hooks["SessionStart"][0]["matcher"], "startup")
        session_start = hooks["SessionStart"][0]["hooks"][0]
        prompt = hooks["UserPromptSubmit"][0]["hooks"][0]
        stop = hooks["Stop"][0]["hooks"][0]
        self.assertEqual(session_start["timeout"], 12)
        self.assertEqual(prompt["timeout"], 3)
        self.assertEqual(stop["timeout"], 60)
        self.assertTrue(stop.get("async"))
        for handler, script in (
            (session_start, "run-hook.sh"),
            (prompt, "run-hook.sh"),
            (stop, "run-hook.sh"),
        ):
            self.assertIn(script, handler["command"])
            self.assertIn("$DIM_PLUGIN_ROOT", handler["command"])
            self.assertIn("run-hook.ps1", handler["commandWindows"])
            self.assertIn("%DIM_PLUGIN_ROOT%", handler["commandWindows"])
        self.assertIn('" context', session_start["command"])
        self.assertIn('" prompt', prompt["command"])
        self.assertIn('" capture', stop["command"])

    def test_mcp_document_is_a_streamable_http_server_for_dim(self):
        document = load(PACKAGE / "mcp.json")
        self.assertEqual(set(document), {"mcpServers"})
        server = document["mcpServers"]["nowledge-mem"]
        self.assertEqual(server["type"], "http")
        self.assertEqual(server["url"], "${NMEM_MCP_URL:-http://127.0.0.1:14242/mcp}")
        self.assertEqual(server["headers"], {"APP": "Dim"})
        self.assertNotIn("X-NMEM-API-Key", server["headers"])


class CopyTests(unittest.TestCase):
    def test_prompt_guidance_is_a_short_routing_decision(self):
        guidance = nmem_hook.PROMPT_GUIDANCE.encode("utf-8")
        self.assertLessEqual(len(guidance), 400)
        self.assertNotIn("`", nmem_hook.PROMPT_GUIDANCE)
        self.assertNotIn("nmem ", nmem_hook.PROMPT_GUIDANCE)
        self.assertIn("never as no matches", nmem_hook.PROMPT_GUIDANCE)
        self.assertIn("Keep the configured identity and Space", nmem_hook.PROMPT_GUIDANCE)

    def test_capture_strips_the_prompt_guidance(self):
        events = [
            {
                "sequence": 1,
                "create_at": 1,
                "type": "input",
                "name": "message",
                "data": {
                    "user": {
                        "content": [
                            {"type": "text", "text": "Operator question"},
                            {
                                "type": "text",
                                "text": '<dim-hooks kind="prompt-submit">\n%s</dim-hooks>'
                                % nmem_hook.PROMPT_GUIDANCE,
                            },
                        ]
                    }
                },
            },
            {
                "sequence": 2,
                "create_at": 2,
                "type": "turn",
                "name": "end",
                "data": {"turn_id": "t", "status": "completed", "reason": "end_turn"},
            },
        ]
        messages = nmem_capture.build_messages(events, "leader", "s")
        self.assertEqual([message["content"] for message in messages], ["Operator question"])

    def test_routing_offers_the_mcp_tools_first(self):
        self.assertIn("Mem MCP tool whose description reads memory search", nmem_hook.ROUTING)
        self.assertIn("when no Mem tool is available", nmem_hook.ROUTING)
        self.assertLess(
            nmem_hook.ROUTING.index("Mem MCP tool"),
            nmem_hook.ROUTING.index("`nmem` CLI"),
        )

    def test_routing_says_the_snapshot_can_be_stale(self):
        self.assertIn("stale after a resume or compaction", nmem_hook.ROUTING)
        self.assertIn("nmem wm read", nmem_hook.ROUTING)
        self.assertIn("Skip retrieval for trivial", nmem_hook.ROUTING)

    def test_startup_context_is_bounded_below_dim_limit(self):
        self.assertLessEqual(nmem_hook.MAX_CONTEXT_BYTES, 15 * 1024)
        bounded = nmem_hook.bound("x" * 40000, 15 * 1024)
        self.assertLessEqual(len(bounded.encode("utf-8")), 15 * 1024)
        self.assertTrue(bounded.endswith("[context truncated]"))
        short = "short text"
        self.assertEqual(nmem_hook.bound(short, 1024), short)


class ExecutableTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(dir=ISOLATED_TMP))
        self.home = self.root / "home"
        (self.home / "rust").mkdir(parents=True)
        self.saved = {key: os.environ.get(key) for key in ("NMEM_DIM_BIN", "PATH")}

    def tearDown(self):
        for key, value in self.saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_prefers_the_users_explicit_override(self):
        link = write_executable(self.home / "rust" / "dimcode-server", "#!/bin/sh\n")
        override = write_executable(self.root / "my-dim", "#!/bin/sh\n")
        os.environ["NMEM_DIM_BIN"] = str(override)
        self.assertEqual(nmem_common.dim_binary(str(self.home)), str(override))
        os.environ["NMEM_DIM_BIN"] = str(self.root / "missing")
        self.assertEqual(nmem_common.dim_binary(str(self.home)), "")
        self.assertTrue(link.exists())

    def test_uses_the_links_the_cli_maintains_for_the_daemon(self):
        os.environ.pop("NMEM_DIM_BIN", None)
        link = write_executable(self.home / "rust" / "dimcode-server", "#!/bin/sh\n")
        self.assertEqual(nmem_common.dim_binary(str(self.home)), str(link))

    def test_never_searches_path(self):
        os.environ.pop("NMEM_DIM_BIN", None)
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        write_executable(bin_dir / "dimcode", "#!/bin/sh\nexit 1\n")
        write_executable(bin_dir / "dima", "#!/bin/sh\nexit 1\n")
        write_executable(bin_dir / "dim", "#!/bin/sh\nexit 1\n")
        os.environ["PATH"] = str(bin_dir)
        self.assertEqual(nmem_common.dim_binary(str(self.home)), "")
        self.assertEqual(nmem_common.dim_binary(""), "")


def turn_end(sequence, turn_id="turn-1", status="completed", reason="end_turn"):
    return {
        "id": "turn-end-%d" % sequence,
        "sequence": sequence,
        "create_at": 1761000000000 + sequence,
        "type": "turn",
        "name": "end",
        "data": {"turn_id": turn_id, "status": status, "reason": reason},
    }


def text_step(sequence, text, request_id="reply", turn_id="turn-1"):
    return {
        "id": "text-%d" % sequence,
        "sequence": sequence,
        "create_at": 1761000000000 + sequence,
        "type": "step",
        "name": "text",
        "data": {"turn_id": turn_id, "request_id": request_id, "delta": text},
    }


def user_input(sequence, text):
    return {
        "id": "input-%d" % sequence,
        "sequence": sequence,
        "create_at": 1761000000000 + sequence,
        "type": "input",
        "name": "message",
        "data": {"user": {"content": [{"type": "text", "text": text}]}},
    }


class MessageTests(unittest.TestCase):
    def test_fixture_keeps_only_the_conversation(self):
        document = load(FIXTURES / "dim-session-export.json")
        messages = nmem_capture.build_messages(document["events"], "leader", document["sessionId"])
        self.assertEqual(
            [(message["role"], message["content"]) for message in messages],
            [
                ("user", "Summarize the release notes."),
                ("assistant", "Here is the summary. It is short."),
            ],
        )
        self.assertEqual(messages[0]["metadata"]["external_id"], "dim:%s:2" % document["sessionId"])
        self.assertIn("timestamp", messages[0])

    def test_a_turn_still_running_is_left_for_the_next_stop(self):
        document = load(FIXTURES / "dim-session-export.json")
        events = list(document["events"]) + [
            user_input(14, "A question whose turn is still running."),
            text_step(15, "Partial answer", request_id="request-running", turn_id="turn-2"),
        ]
        messages = nmem_capture.build_messages(events, "leader", document["sessionId"])
        self.assertEqual(
            [message["content"] for message in messages],
            ["Summarize the release notes.", "Here is the summary. It is short."],
        )
        self.assertNotIn("Partial answer", json.dumps(messages))

    def test_a_turn_without_any_turn_end_captures_nothing(self):
        events = [user_input(1, "Question"), text_step(2, "Answer")]
        self.assertEqual(nmem_capture.build_messages(events, "leader", "s"), [])

    def test_whitespace_only_deltas_between_text_events_are_kept(self):
        events = [
            user_input(1, "Question"),
            text_step(2, "Hello", request_id="request-1"),
            text_step(3, " ", request_id="request-1"),
            text_step(4, "world", request_id="request-1"),
            text_step(5, "\n", request_id="request-1"),
            text_step(6, "Next", request_id="request-1"),
            turn_end(7),
        ]
        messages = nmem_capture.build_messages(events, "leader", "s")
        self.assertEqual(
            [(message["role"], message["content"]) for message in messages],
            [("user", "Question"), ("assistant", "Hello world\nNext")],
        )

    def test_a_reply_that_is_only_whitespace_is_still_empty(self):
        events = [
            user_input(1, "Question"),
            text_step(2, " ", request_id="request-1"),
            text_step(3, "\n", request_id="request-1"),
            turn_end(4),
        ]
        messages = nmem_capture.build_messages(events, "leader", "s")
        self.assertEqual([message["content"] for message in messages], ["Question"])

    def test_failed_and_cancelled_turns_keep_input_but_not_text(self):
        for status in ("failed", "cancelled"):
            events = [
                user_input(1, "First question"),
                text_step(2, "First partial answer", request_id="request-1", turn_id="turn-1"),
                turn_end(3, turn_id="turn-1", status=status, reason="error"),
                user_input(4, "Second question"),
                text_step(5, "Second answer", request_id="request-2", turn_id="turn-2"),
                turn_end(6, turn_id="turn-2"),
            ]
            messages = nmem_capture.build_messages(events, "leader", "s")
            self.assertEqual(
                [(message["role"], message["content"]) for message in messages],
                [
                    ("user", "First question"),
                    ("user", "Second question"),
                    ("assistant", "Second answer"),
                ],
                status,
            )

    def test_a_failed_request_inside_a_completed_turn_is_not_a_reply(self):
        events = [
            user_input(1, "Question"),
            text_step(2, "Abandoned partial text", request_id="request-a"),
            {
                "id": "end-a",
                "sequence": 3,
                "create_at": 3,
                "type": "step",
                "name": "model-output-end",
                "data": {
                    "turn_id": "turn-1",
                    "request_id": "request-a",
                    "status": "failed",
                    "finish_reason": "error",
                },
            },
            text_step(4, "Final answer", request_id="request-b"),
            {
                "id": "end-b",
                "sequence": 5,
                "create_at": 5,
                "type": "step",
                "name": "model-output-end",
                "data": {
                    "turn_id": "turn-1",
                    "request_id": "request-b",
                    "status": "completed",
                    "finish_reason": "end_turn",
                },
            },
            turn_end(6),
        ]
        messages = nmem_capture.build_messages(events, "leader", "s")
        self.assertEqual(
            [(message["role"], message["content"]) for message in messages],
            [("user", "Question"), ("assistant", "Final answer")],
        )

    def test_member_turn_is_the_unwrapped_task(self):
        events = [
            {
                "sequence": 1,
                "create_at": 1761000000000,
                "type": "input",
                "name": "message",
                "data": {
                    "blocks": [
                        {
                            "type": "raw",
                            "text": '<dim-agent-message agent="lead-1">Agent lead-1, your team leader, '
                            "assigned you this work:\nReview the notes.</dim-agent-message>",
                        }
                    ]
                },
            },
            turn_end(2),
        ]
        messages = nmem_capture.build_messages(events, "member", "s-member")
        self.assertEqual(len(messages), 1)
        self.assertEqual(
            messages[0]["content"],
            "Agent lead-1, your team leader, assigned you this work:\nReview the notes.",
        )
        self.assertNotIn("<dim-agent-message", messages[0]["content"])

    def test_a_leader_raw_block_is_not_operator_input(self):
        events = [
            {
                "sequence": 1,
                "create_at": 1761000000000,
                "type": "input",
                "name": "message",
                "data": {"blocks": [{"type": "raw", "text": "<dim-state>x</dim-state>"}]},
            },
            turn_end(2),
        ]
        self.assertEqual(nmem_capture.build_messages(events, "leader", "s"), [])

    def test_every_injected_hook_block_is_stripped(self):
        for marker in (
            '<dim-hooks kind="prompt-submit">guidance</dim-hooks>',
            '<dim-hooks kind="session-start">briefing</dim-hooks>',
        ):
            self.assertTrue(nmem_capture._is_injected(marker))
            events = [
                {
                    "sequence": 1,
                    "create_at": 1,
                    "type": "input",
                    "name": "message",
                    "data": {"user": {"content": [{"type": "text", "text": marker}]}},
                },
                turn_end(2),
            ]
            self.assertEqual(nmem_capture.build_messages(events, "leader", "s"), [])


class AcknowledgementTests(unittest.TestCase):
    def test_checkpointed_append_is_accepted(self):
        status, count = nmem_capture.acknowledgement(
            True,
            {
                "success": True,
                "failed_count": 0,
                "results": [
                    {"success": True, "append_mode": "checkpointed", "message_count": 4}
                ],
            },
            True,
        )
        self.assertEqual((status, count), ("acknowledged", 4))

    def test_a_non_checkpointed_append_is_rejected_when_one_was_expected(self):
        status, _ = nmem_capture.acknowledgement(
            True,
            {"success": True, "failed_count": 0, "results": [{"success": True, "message_count": 4}]},
            True,
        )
        self.assertEqual(status, "failed")

    def test_conflict_and_thread_not_found_are_recoverable(self):
        for code in ("checkpoint_conflict", "thread_not_found"):
            status, count = nmem_capture.acknowledgement(
                False,
                {"success": False, "failed_count": 1, "results": [{"success": False, "error_code": code}]},
                True,
            )
            self.assertEqual((status, count), ("conflict", None))

    def test_failed_counts_and_shapes_are_rejected(self):
        cases = [
            {"success": False, "failed_count": 1, "results": []},
            {"success": True, "failed_count": 2, "results": [{"success": True, "message_count": 1}]},
            {"success": True, "failed_count": 0, "results": []},
            {"success": True, "failed_count": 0, "results": [{"success": True, "message_count": "2"}]},
        ]
        for payload in cases:
            status, _ = nmem_capture.acknowledgement(True, payload, False)
            self.assertEqual(status, "failed", payload)


class LockTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(dir=ISOLATED_TMP))

    def test_lock_is_exclusive_and_stale_locks_are_replaced(self):
        key = "a" * 32
        first = nmem_capture.acquire_lock(self.root, key)
        self.assertIsNotNone(first)
        self.assertIsNone(nmem_capture.acquire_lock(self.root, key))
        stale = self.root / (key + ".lock")
        old = 1_000_000_000
        os.utime(str(stale), (old, old))
        replaced = nmem_capture.acquire_lock(self.root, key)
        self.assertIsNotNone(replaced)
        replaced.unlink()
        self.assertFalse((self.root / (key + ".lock")).exists())

    def test_pending_marker_round_trip(self):
        key = "b" * 32
        nmem_capture.mark_pending(self.root, key)
        self.assertTrue((self.root / (key + ".pending")).exists())
        nmem_capture.clear_pending(self.root, key)
        self.assertFalse((self.root / (key + ".pending")).exists())


FAKE_DIM = """#!/usr/bin/env python3
import os, sys
sys.stdout.write(open(os.environ["TEST_EXPORT"], encoding="utf-8").read())
"""

FAKE_NMEM = """#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
argv = sys.argv[1:]
args = argv
file_path = args[args.index("--file") + 1] if "--file" in args else ""
payload = json.loads(Path(file_path).read_text(encoding="utf-8"))
with open(os.environ["TEST_NMEM_LOG"], "a", encoding="utf-8") as handle:
    handle.write(json.dumps({"argv": argv, "messages": payload.get("messages")}) + "\\n")
if Path(os.environ["TEST_CONFLICT"]).exists():
    Path(os.environ["TEST_CONFLICT"]).unlink()
    sys.stdout.write(json.dumps({"success": False, "failed_count": 1,
        "results": [{"success": False, "error_code": "checkpoint_conflict"}]}) + "\\n")
    sys.exit(1)
messages = payload.get("messages") or []
threads_path = Path(os.environ["TEST_THREADS"])
threads = json.loads(threads_path.read_text(encoding="utf-8")) if threads_path.exists() else {}
thread_id = args[args.index("--id") + 1] if "--id" in args else ""
previous = threads.get(thread_id, 0)
if "--expected-message-count" in args:
    expected = int(args[args.index("--expected-message-count") + 1])
    if expected != previous:
        sys.stdout.write(json.dumps({"success": False, "failed_count": 1,
            "results": [{"success": False, "error_code": "checkpoint_conflict"}]}) + "\\n")
        sys.exit(1)
    append_mode = "checkpointed"
else:
    expected = previous
    append_mode = "created" if previous == 0 else "appended"
# Mem keeps records by external id, role and content: a full re-import into
# an existing thread keeps the old versions of changed messages, so its total
# grows by the whole local list rather than matching it.
total = expected + len(messages)
threads[thread_id] = total
threads_path.write_text(json.dumps(threads), encoding="utf-8")
result = {"success": True, "append_mode": append_mode, "message_count": total}
sys.stdout.write(json.dumps({"success": True, "failed_count": 0, "results": [result]}) + "\\n")
"""


class CaptureProcessTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(dir=ISOLATED_TMP))
        self.home = self.root / "dimhome"
        (self.home / "rust").mkdir(parents=True)
        write_executable(self.home / "rust" / "dimcode-server", FAKE_DIM)
        self.nmem = write_executable(self.root / "nmem", FAKE_NMEM)
        self.export_path = self.root / "export.json"
        self.export_path.write_bytes((FIXTURES / "dim-session-export.json").read_bytes())
        self.log = self.root / "nmem.jsonl"
        self.conflict = self.root / "conflict.flag"
        self.env = {
            "HOME": str(self.root / "home"),
            "TMPDIR": str(self.root / "tmp"),
            "DIMCODE_HOME": str(self.home),
            "NMEM_CLI_PATH": str(self.nmem),
            "TEST_EXPORT": str(self.export_path),
            "TEST_NMEM_LOG": str(self.log),
            "TEST_CONFLICT": str(self.conflict),
            "TEST_THREADS": str(self.root / "threads.json"),
            "PATH": "/usr/bin:/bin",
        }
        (self.root / "tmp").mkdir()

    def run_capture(self, session_id="s-capture", role="leader"):
        payload = json.dumps(
            {"hook_event_name": "Stop", "session_id": session_id, "collaboration_role": role}
        )
        return subprocess.run(
            [sys.executable, "-I", str(SCRIPTS / "nmem_capture.py")],
            input=payload,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=self.env,
            timeout=60,
        )

    def calls(self):
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def state_root_path(self):
        return Path(self.env["TMPDIR"]) / "nowledge-mem" / nmem_common.state_dirname()

    def state(self, session_id="s-capture"):
        key = nmem_common.session_key(str(self.home), session_id)
        path = self.state_root_path() / (key + ".json")
        return json.loads(path.read_text())

    def test_first_capture_imports_the_conversation_and_keeps_content_out_of_state(self):
        completed = self.run_capture()
        self.assertEqual(completed.returncode, 0, completed.stderr)
        calls = self.calls()
        self.assertEqual(len(calls), 1)
        argv = calls[0]["argv"]
        self.assertEqual(argv[:2], ["--json", "t"])
        self.assertIn("dim-s-capture", argv)
        self.assertEqual(argv[argv.index("--source") + 1], "dim")
        self.assertNotIn("--expected-message-count", argv)
        self.assertEqual(
            [(message["role"], message["content"]) for message in calls[0]["messages"]],
            [
                ("user", "Summarize the release notes."),
                ("assistant", "Here is the summary. It is short."),
            ],
        )
        state = self.state()
        self.assertEqual(set(state), {"position", "digest", "count"})
        self.assertEqual(state["position"], 2)
        self.assertEqual(state["count"], 2)
        self.assertNotIn("Summarize", json.dumps(state))
        log_path = self.state_root_path() / "nowledge-mem-dim-hook.log"
        log_text = log_path.read_text()
        self.assertIn('"status": "imported"', log_text)
        self.assertNotIn("Summarize the release notes", log_text)
        self.assertNotIn("Here is the summary", log_text)
        self.assertEqual(stat.S_IMODE(log_path.stat().st_mode), 0o600)
        self.assertEqual(
            {path.relative_to(self.home) for path in self.home.rglob("*")},
            {Path("rust"), Path("rust/dimcode-server")},
        )

    def test_unchanged_conversation_is_not_imported_again(self):
        self.assertEqual(self.run_capture().returncode, 0)
        self.assertEqual(self.run_capture().returncode, 0)
        self.assertEqual(len(self.calls()), 1)

    def test_new_messages_are_appended_with_a_checkpoint(self):
        self.assertEqual(self.run_capture().returncode, 0)
        self.append_turn("Second question.", "Second answer.")
        self.assertEqual(self.run_capture().returncode, 0)
        calls = self.calls()
        self.assertEqual(len(calls), 2)
        argv = calls[1]["argv"]
        self.assertEqual(argv[argv.index("--expected-message-count") + 1], "2")
        self.assertIn("--idempotency-key", argv)
        self.assertEqual(
            [(message["role"], message["content"]) for message in calls[1]["messages"]],
            [("user", "Second question."), ("assistant", "Second answer.")],
        )
        self.assertEqual(self.state()["position"], 4)
        self.assertEqual(self.state()["count"], 4)

    def test_a_checkpoint_conflict_causes_one_full_reimport_then_a_delta(self):
        self.assertEqual(self.run_capture().returncode, 0)
        self.append_turn("Second question.", "Second answer.")
        self.conflict.write_text("1")
        self.assertEqual(self.run_capture().returncode, 0)
        calls = self.calls()
        self.assertEqual(len(calls), 3)
        self.assertIn("--expected-message-count", calls[1]["argv"])
        self.assertNotIn("--expected-message-count", calls[2]["argv"])
        self.assertEqual(len(calls[2]["messages"]), 4)
        state = self.state()
        self.assertEqual(state["position"], 4)
        self.assertEqual(state["count"], 6)  # Mem kept its first copy of all four
        # One more turn: the local position bounds the delta, and Mem's larger
        # total is what the checkpoint expects.
        self.append_turn("Third question.", "Third answer.", turn=3)
        self.assertEqual(self.run_capture().returncode, 0)
        calls = self.calls()
        self.assertEqual(len(calls), 4)
        argv = calls[3]["argv"]
        self.assertEqual(argv[argv.index("--expected-message-count") + 1], "6")
        self.assertEqual(
            [(message["role"], message["content"]) for message in calls[3]["messages"]],
            [("user", "Third question."), ("assistant", "Third answer.")],
        )
        state = self.state()
        self.assertEqual(state["position"], 6)
        self.assertEqual(state["count"], 8)

    def append_turn(self, question, answer, turn=2):
        first = 14 + (turn - 2) * 3
        document = load(self.export_path)
        document["events"].extend(
            [
                {
                    "id": "fixture-input-%d" % turn,
                    "sequence": first,
                    "create_at": 1761000009000 + first,
                    "type": "input",
                    "name": "message",
                    "data": {"user": {"content": [{"type": "text", "text": question}]}},
                },
                {
                    "id": "fixture-text-%d" % turn,
                    "sequence": first + 1,
                    "create_at": 1761000009000 + first + 1,
                    "type": "step",
                    "name": "text",
                    "data": {
                        "turn_id": "turn-%d" % turn,
                        "request_id": "request-reply-%d" % turn,
                        "delta": answer,
                    },
                },
                turn_end(first + 2, turn_id="turn-%d" % turn),
            ]
        )
        self.export_path.write_text(json.dumps(document), encoding="utf-8")

    def test_a_changed_prefix_triggers_one_full_reimport_then_a_delta(self):
        self.assertEqual(self.run_capture().returncode, 0)
        document = load(self.export_path)
        for event in document["events"]:
            if event.get("sequence") == 2:
                event["data"]["user"]["content"][0]["text"] = "Summarize the archived release notes."
        self.export_path.write_text(json.dumps(document), encoding="utf-8")
        self.assertEqual(self.run_capture().returncode, 0)
        calls = self.calls()
        self.assertEqual(len(calls), 2)
        self.assertNotIn("--expected-message-count", calls[1]["argv"])
        self.assertEqual(
            [(message["role"], message["content"]) for message in calls[1]["messages"]],
            [
                ("user", "Summarize the archived release notes."),
                ("assistant", "Here is the summary. It is short."),
            ],
        )
        state = self.state()
        self.assertEqual(state["position"], 2)
        self.assertEqual(state["count"], 4)  # the old first question stayed in Mem
        # One more turn: only the new turn is sent, against Mem's total.
        self.append_turn("Second question.", "Second answer.")
        self.assertEqual(self.run_capture().returncode, 0)
        calls = self.calls()
        self.assertEqual(len(calls), 3)
        argv = calls[2]["argv"]
        self.assertEqual(argv[argv.index("--expected-message-count") + 1], "4")
        self.assertEqual(
            [(message["role"], message["content"]) for message in calls[2]["messages"]],
            [("user", "Second question."), ("assistant", "Second answer.")],
        )
        state = self.state()
        self.assertEqual(state["position"], 4)
        self.assertEqual(state["count"], 6)

    def test_an_earlier_state_file_without_a_position_is_a_full_import(self):
        root = self.state_root_path()
        root.mkdir(parents=True, mode=0o700)
        key = nmem_common.session_key(str(self.home), "s-capture")
        (root / (key + ".json")).write_text(
            json.dumps({"count": 2, "digest": "0" * 64}), encoding="utf-8"
        )
        self.assertEqual(self.run_capture().returncode, 0)
        calls = self.calls()
        self.assertEqual(len(calls), 1)
        self.assertNotIn("--expected-message-count", calls[0]["argv"])
        self.assertEqual(len(calls[0]["messages"]), 2)
        self.assertEqual(set(self.state()), {"position", "digest", "count"})

    def test_a_symlinked_import_file_is_not_followed(self):
        root = self.state_root_path()
        root.mkdir(parents=True, mode=0o700)
        key = nmem_common.session_key(str(self.home), "s-capture")
        target = self.root / "target.txt"
        target.write_text("original", encoding="utf-8")
        os.symlink(target, root / (key + ".import.json"))
        completed = self.run_capture()
        self.assertEqual(completed.returncode, 0)
        self.assertEqual(self.calls(), [])
        self.assertEqual(target.read_text(encoding="utf-8"), "original")

    def test_a_loose_state_directory_skips_without_writing(self):
        root = self.state_root_path()
        root.mkdir(parents=True)
        root.chmod(0o755)
        completed = self.run_capture()
        self.assertEqual(completed.returncode, 0)
        self.assertEqual(self.calls(), [])
        self.assertEqual(list(root.iterdir()), [])

    def test_a_member_capture_uses_the_unwrapped_task(self):
        document = {
            "sessionId": "s-member",
            "branchId": "main",
            "through": 1,
            "events": [
                {
                    "id": "fixture-1",
                    "sequence": 1,
                    "create_at": 1761000000000,
                    "type": "input",
                    "name": "message",
                    "data": {
                        "blocks": [
                            {
                                "type": "raw",
                                "text": '<dim-agent-message agent="lead-1">Agent lead-1, your team leader, '
                                "assigned you this work:\nReview the notes.</dim-agent-message>",
                            }
                        ]
                    },
                },
                turn_end(2),
            ],
        }
        self.export_path.write_text(json.dumps(document), encoding="utf-8")
        self.assertEqual(self.run_capture(session_id="s-member", role="member").returncode, 0)
        self.assertEqual(self.state("s-member")["count"], 1)


class StateRootSecurityTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(dir=ISOLATED_TMP))
        self.tmp = self.root / "tmp"
        self.tmp.mkdir()

    def path(self):
        return self.tmp / "nowledge-mem" / nmem_common.state_dirname()

    def test_a_loose_state_directory_is_rejected(self):
        path = self.path()
        path.mkdir(parents=True)
        path.chmod(0o755)
        with mock.patch.object(nmem_common.tempfile, "gettempdir", return_value=str(self.tmp)):
            self.assertIsNone(nmem_common.state_root())
        self.assertEqual(list(path.iterdir()), [])

    def test_a_directory_owned_by_someone_else_is_rejected(self):
        with mock.patch.object(nmem_common.tempfile, "gettempdir", return_value=str(self.tmp)):
            self.assertIsNotNone(nmem_common.state_root())
            with mock.patch.object(
                nmem_common.os, "getuid", return_value=os.getuid() + 1
            ):
                self.assertIsNone(nmem_common.state_root())

    @unittest.skipIf(os.name == "nt", "POSIX symlink semantics")
    def test_a_symlinked_root_is_rejected(self):
        parent = self.tmp / "nowledge-mem"
        parent.mkdir()
        target = self.tmp / "elsewhere"
        target.mkdir()
        os.symlink(target, self.path())
        with mock.patch.object(nmem_common.tempfile, "gettempdir", return_value=str(self.tmp)):
            self.assertIsNone(nmem_common.state_root())


class RunCappedTests(unittest.TestCase):
    def test_a_live_reader_is_a_timeout_not_a_partial_success(self):
        root = Path(tempfile.mkdtemp(dir=ISOLATED_TMP))
        child = root / "child.py"
        child.write_text(
            "import subprocess, sys\n"
            "subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(3)'])\n"
            "sys.stdout.write('partial')\n"
            "sys.stdout.flush()\n",
            encoding="utf-8",
        )
        started = time.monotonic()
        data, reason = nmem_common.run_capped(sys.executable, [str(child)], 5.0, 1024)
        elapsed = time.monotonic() - started
        self.assertIsNone(data)
        self.assertEqual(reason, "timeout")
        self.assertLess(elapsed, 5.0)


class PromptLauncherTests(unittest.TestCase):
    def test_posix_prompt_launcher_matches_the_python_text(self):
        if os.name == "nt":
            self.skipTest("POSIX launcher")
        completed = subprocess.run(
            ["/bin/sh", str(SCRIPTS / "run-hook.sh"), "prompt"],
            input=json.dumps({"hook_event_name": "UserPromptSubmit", "session_id": "s"}),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        data = json.loads(completed.stdout)
        self.assertEqual(
            data["hookSpecificOutput"],
            {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": nmem_hook.PROMPT_GUIDANCE,
            },
        )

    def test_windows_prompt_launcher_carries_the_same_text(self):
        text = (SCRIPTS / "run-hook.ps1").read_text(encoding="utf-8")
        start = text.index("[Console]::Out.Write('") + len("[Console]::Out.Write('")
        end = text.index("' + \"`n\")", start)
        data = json.loads(text[start:end])
        self.assertEqual(
            data["hookSpecificOutput"]["additionalContext"], nmem_hook.PROMPT_GUIDANCE
        )

    def test_python_prompt_branch_still_matches(self):
        completed = subprocess.run(
            [sys.executable, "-I", str(SCRIPTS / "nmem_hook.py"), "prompt"],
            input=json.dumps({"hook_event_name": "UserPromptSubmit", "session_id": "s"}),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30,
            env={"TMPDIR": ISOLATED_TMP, "PATH": "/usr/bin:/bin"},
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        data = json.loads(completed.stdout)
        self.assertEqual(
            data["hookSpecificOutput"]["additionalContext"], nmem_hook.PROMPT_GUIDANCE
        )


class SkillTests(unittest.TestCase):
    NAMES = ("read-working-memory", "search-memory", "distill-memory", "explore-graph", "status")
    SHARED = {
        "read-working-memory": ("do not report a failed read as an empty briefing",),
        "search-memory": (
            "do not report a failed search as",
            "one bounded thread read per question",
        ),
        "distill-memory": ("do not wait to be asked", "0.8–1.0"),
        "explore-graph": ("never claim a graph was rendered",),
        "status": ("do not describe a failed call as an empty memory",),
    }
    OTHER_HOST_TOOLS = (
        "memory_search",
        "memory_add",
        "memory_update",
        "memory_delete",
        "thread_search",
        "thread_fetch_messages",
        "read_context_bundle",
        "explore_graph",
        "find_skills",
        "report_skill_outcome",
        "list_spaces",
        "mcp__",
    )

    def test_five_skills_with_matching_frontmatter(self):
        directories = sorted(path for path in (PACKAGE / "skills").iterdir() if path.is_dir())
        self.assertEqual({path.name for path in directories}, set(self.NAMES))
        self.assertEqual(len(directories), len(self.NAMES))
        for directory in directories:
            text = (directory / "SKILL.md").read_text(encoding="utf-8")
            self.assertTrue(text.startswith("---\n"), directory.name)
            header = text.split("---\n", 2)[1]
            self.assertIn("name: %s" % directory.name, header)
            self.assertIn("description:", header)

    def test_shared_behaviour_sentences_are_present(self):
        for name, sentences in self.SHARED.items():
            text = (PACKAGE / "skills" / name / "SKILL.md").read_text(encoding="utf-8").lower()
            for sentence in sentences:
                self.assertIn(sentence, text, name)

    def test_no_other_host_tool_names_are_used(self):
        for directory in (PACKAGE / "skills").iterdir():
            if not directory.is_dir():
                continue
            text = (directory / "SKILL.md").read_text(encoding="utf-8")
            for tool in self.OTHER_HOST_TOOLS:
                self.assertNotIn(tool, text, "%s names %s" % (directory.name, tool))

    def test_no_skill_or_injected_text_tells_the_model_to_run_a_dim_command(self):
        texts = {"ROUTING": nmem_hook.ROUTING, "PROMPT_GUIDANCE": nmem_hook.PROMPT_GUIDANCE}
        for directory in (PACKAGE / "skills").iterdir():
            if directory.is_dir():
                texts[directory.name] = (directory / "SKILL.md").read_text(encoding="utf-8")
        for name, text in texts.items():
            for command in ("dimcode ", "dima ", " dim "):
                self.assertNotIn(command, text, "%s tells the model to run %r" % (name, command))


class LauncherAndDocsTests(unittest.TestCase):
    def test_launchers_dispatch_both_scripts(self):
        posix = (SCRIPTS / "run-hook.sh").read_text(encoding="utf-8")
        powershell = (SCRIPTS / "run-hook.ps1").read_text(encoding="utf-8")
        for text in (posix, powershell):
            self.assertIn("nmem_hook.py", text)
            self.assertIn("nmem_capture.py", text)
        mode = (SCRIPTS / "run-hook.sh").stat().st_mode
        self.assertTrue(mode & stat.S_IXUSR)

    def test_readme_documents_the_executable_rule(self):
        readme = (PACKAGE / "README.md").read_text(encoding="utf-8")
        for sentence in (
            "NMEM_DIM_BIN",
            "dimcode-server",
            "never searches `PATH`",
            "shuts that daemon down",
            "v0.1.0-alpha.20",
        ):
            self.assertIn(sentence, readme)

    def test_readme_documents_the_capture_and_sandbox_limits(self):
        readme = (PACKAGE / "README.md").read_text(encoding="utf-8")
        self.assertIn("last `turn/end`", readme)
        self.assertIn(
            "A failed or cancelled turn fires no Stop, so its operator input is captured at",
            readme,
        )
        self.assertIn("execution sandbox on and network off", readme)
        self.assertIn("dim-capture-<uid>", readme)

    def test_version_lives_in_the_changelog(self):
        changelog = (PACKAGE / "CHANGELOG.md").read_text(encoding="utf-8")
        self.assertIn("## 0.1.0", changelog)


if __name__ == "__main__":
    unittest.main()
