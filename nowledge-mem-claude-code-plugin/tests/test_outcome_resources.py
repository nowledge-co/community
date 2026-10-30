"""Resource/ownership regressions; all fixtures are synthetic and test-owned."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import tracemalloc
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
HOOK = ROOT / "nowledge-mem-claude-code-plugin/scripts/nmem-hook-save.py"


def load(path):
    spec = importlib.util.spec_from_file_location("resource_case", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class OutcomeResources(unittest.TestCase):
    def parsers(self):
        return [load(ROOT / rel) for rel in (
            "nowledge-mem-claude-code-plugin/scripts/skill_outcome.py",
            "nowledge-mem-codex-plugin/hooks/skill_outcome.py",
        )]

    def test_large_transcript_does_not_accumulate_records(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "session.jsonl"
            call = {"name": "find_skills", "id": "call"}
            result = {"tool_use_id": "call", "content": {"skill_id": "skill-one", "version": 3}}
            with path.open("w") as stream:
                stream.write(json.dumps(result) + "\n")
                for _ in range(128):
                    stream.write(json.dumps({"text": "x" * 65536}) + "\n")
                stream.write(json.dumps(call) + "\n")
            for parser in self.parsers():
                with self.subTest(parser=parser.__file__):
                    tracemalloc.start()
                    try:
                        self.assertEqual(parser.extract_skill_outcomes_from_file(str(path)), [("skill-one", "3")])
                        peak = tracemalloc.get_traced_memory()[1]
                    finally:
                        tracemalloc.stop()
                    self.assertLess(peak, 5 * 1024 * 1024)

    def test_oversized_record_is_not_materialized_or_reported(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "session.jsonl"
            path.write_text(json.dumps({"name": "find_skills", "result": {
                "skill_id": "skill-one", "version": 3, "text": "x" * (3 * 1024 * 1024)}}))
            for parser in self.parsers():
                with self.subTest(parser=parser.__file__):
                    self.assertEqual(parser.extract_skill_outcomes_from_file(str(path)), [])

    def test_pretty_json_and_unrelated_results_preserve_matching(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "session.json"
            path.write_text(json.dumps([
                {"tool_use_id": "other", "content": {"skill_id": "skill-wrong", "version": 1}},
                {"name": "find_skills", "id": "right"},
                {"tool_use_id": "right", "content": {"skill_id": "skill-right", "version": 2}},
            ], indent=2))
            for parser in self.parsers():
                self.assertEqual(parser.extract_skill_outcomes_from_file(str(path)), [("skill-right", "2")])

    def test_scan_deadline_discards_partial_telemetry(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "session.jsonl"
            path.write_text(json.dumps({"name": "find_skills", "result": {
                "skill_id": "skill-one", "version": 3}}))
            for parser in self.parsers():
                with patch("time.monotonic", side_effect=[0.0, 5.0]):
                    self.assertEqual(parser.extract_skill_outcomes_from_file(str(path)), [])

    def test_reference_count_limit_does_not_grow_with_session(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "session.jsonl"
            with path.open("w") as stream:
                for i in range(4097):
                    stream.write(json.dumps({"name": "find_skills", "id": str(i), "result": {
                        "skill_id": "skill-one", "version": 3}}) + "\n")
            for parser in self.parsers():
                self.assertEqual(parser.extract_skill_outcomes_from_file(str(path)), [])

    def test_reporting_shares_one_budget_and_heartbeats(self):
        hook = load(HOOK)
        now = [0.0]
        def run(command, timeout):
            self.assertLessEqual(timeout, 8.0)
            now[0] += 8.0
            return subprocess.CompletedProcess(command, 0, "", "")
        with patch.object(hook.time, "monotonic", side_effect=lambda: now[0]), \
             patch.object(hook, "extract_skill_outcomes_from_file", return_value=[("skill-one", "1"), ("skill-two", "2")]), \
             patch.object(hook, "_claim_skill_outcome_report", return_value=Path("unused")), \
             patch.object(hook, "_run_command", side_effect=run) as command, \
             patch.object(hook, "_touch_background_worker") as heartbeat:
            hook._report_skill_outcomes("nmem", {}, heartbeat=heartbeat)
            self.assertEqual(command.call_count, 1)
            self.assertEqual(heartbeat.call_count, 1)

    def test_rejected_contender_hands_off_after_owner_finishes(self):
        hook = load(HOOK)
        with tempfile.TemporaryDirectory() as root:
            state = Path(root)
            key = "handoff-session"
            with patch.object(hook, "_background_state_root", return_value=state):
                token = hook._claim_background_worker(key)
                hook._enqueue_background_payload(key, {"session_id": "one"})
                child_code = r"""
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('hook', sys.argv[1])
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
root = pathlib.Path(sys.argv[2])
hook._background_state_root = lambda: root
def capture(*args, **kwargs):
    (root / 'entered').touch()
    assert sys.stdin.readline().strip() == 'release'
    return 0
hook._capture_payload = capture
hook._drain_background_capture('handoff-session', 'stop', sys.argv[3])
"""
                child = subprocess.Popen([sys.executable, "-c", child_code, str(HOOK), root, token], stdin=subprocess.PIPE)
                try:
                    deadline = time.monotonic() + 10
                    while not (state / "entered").exists():
                        self.assertIsNone(child.poll())
                        self.assertLess(time.monotonic(), deadline)
                        time.sleep(0.01)
                    lease = hook._background_lease_path(key)
                    stale = time.time() - hook.BACKGROUND_LEASE_STALE_SECONDS - 1
                    os.utime(lease, (stale, stale))
                    contender = hook._claim_background_worker(key)
                    self.assertIsNotNone(contender)
                    real_release = hook._release_background_worker
                    settled = [False]
                    def release(k, t):
                        if t == contender and not settled[0]:
                            settled[0] = True
                            # A exits while B still owns a fresh scheduling lease.
                            child.communicate(input=b"release\n", timeout=10)
                            self.assertEqual(child.returncode, 0)
                            with patch.object(hook, "_spawn_background_worker") as spawn:
                                hook._enqueue_background_payload(key, {"session_id": "new"})
                                self.assertIsNone(hook._claim_background_worker(key))
                                spawn.assert_not_called()
                        real_release(k, t)
                    with patch.object(hook, "_release_background_worker", side_effect=release), \
                         patch.object(hook, "_capture_payload", return_value=0) as capture:
                        hook._drain_background_capture(key, "stop", contender)
                        self.assertEqual(capture.call_count, 1)
                        self.assertEqual(capture.call_args.args[1], {"session_id": "new"})
                        self.assertFalse(hook._background_payload_pending(key))
                finally:
                    if child.poll() is None:
                        child.kill()
                    child.wait(timeout=10)
                    if not child.stdin.closed:
                        child.stdin.close()

    def test_stale_lease_cannot_overlap_live_drain_and_recovers(self):
        hook = load(HOOK)
        with tempfile.TemporaryDirectory() as root:
            state = Path(root)
            key = "owned-session"
            with patch.object(hook, "_background_state_root", return_value=state):
                token = hook._claim_background_worker(key)
                hook._enqueue_background_payload(key, {"session_id": "one"})
                child_code = r"""
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('hook', sys.argv[1])
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
root = pathlib.Path(sys.argv[2])
hook._background_state_root = lambda: root
def capture(*args, **kwargs):
    (root / 'entered').touch()
    assert sys.stdin.readline().strip() == 'release'
    return 0
hook._capture_payload = capture
hook._drain_background_capture('owned-session', 'stop', sys.argv[3])
"""
                child = subprocess.Popen([sys.executable, "-c", child_code, str(HOOK), root, token], stdin=subprocess.PIPE)
                try:
                    deadline = time.monotonic() + 10
                    while not (state / "entered").exists():
                        self.assertIsNone(child.poll())
                        self.assertLess(time.monotonic(), deadline)
                        time.sleep(0.01)
                    lease = hook._background_lease_path(key)
                    stale = time.time() - hook.BACKGROUND_LEASE_STALE_SECONDS - 1
                    os.utime(lease, (stale, stale))
                    hook._enqueue_background_payload(key, {"session_id": "two"})
                    contender = hook._claim_background_worker(key)
                    with patch.object(hook, "_capture_payload", return_value=0) as capture:
                        if contender:
                            hook._drain_background_capture(key, "stop", contender)
                        self.assertEqual(capture.call_count, 0, "a second worker consumed the pending capture")
                    # Simulate abrupt owner loss: OS custody must be released.
                    child.kill()
                    child.wait(timeout=10)
                    if lease.exists():
                        os.utime(lease, (stale, stale))
                    recovered = hook._claim_background_worker(key)
                    self.assertIsNotNone(recovered)
                    with patch.object(hook, "_capture_payload", return_value=0) as capture:
                        hook._drain_background_capture(key, "stop", recovered)
                        self.assertEqual(capture.call_count, 1)
                        self.assertEqual(capture.call_args.args[1], {"session_id": "two"})
                finally:
                    if child.poll() is None:
                        child.kill()
                    child.wait(timeout=10)
                    child.stdin.close()


if __name__ == "__main__":
    unittest.main()
