"""Exercise real hook resources without contacting Mem or running the host."""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


HOOKS = Path(__file__).resolve().parent.parent / "hooks"


def load_hook(name):
    spec = importlib.util.spec_from_file_location(name, HOOKS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@unittest.skipUnless(os.name == "posix", "POSIX descriptor lifecycle checks")
class DescriptorLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.stop = load_hook("nmem-stop-save")
        self.context = load_hook("nmem-context")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.stop._log_path = lambda: self.root / "hook.log"
        self.stop._capture_lock_root = lambda payload: self.root / "locks"

    def fd_count(self):
        directory = Path("/proc/self/fd")
        if not directory.is_dir():
            directory = Path("/dev/fd")
        if not directory.is_dir():
            self.skipTest("Descriptor directory unavailable")
        return len(os.listdir(directory))

    def test_repeated_file_reads_and_lock_claims_release_descriptors(self):
        transcript = self.root / "transcript.jsonl"
        transcript.write_text(json.dumps({
            "type": "session_meta", "payload": {"originator": "codex_cli"},
        }) + "\n", encoding="utf-8")
        before = self.fd_count()
        for index in range(50):
            payload = {"session_id": str(index), "transcript_path": str(transcript)}
            self.assertEqual(self.stop._transcript_originator(str(transcript)), "codex_cli")
            self.stop._log("descriptor regression")
            self.assertTrue(self.stop._claim_capture_event(payload))
            self.assertIsNotNone(self.stop._claim_skill_outcome_report(payload, "skill", "1"))
        self.assertEqual(self.fd_count(), before)

    def test_cli_success_failure_and_timeout_release_pipes(self):
        before = self.fd_count()
        cases = (
            ("print('{}')", 2.0, {}),
            ("raise SystemExit(2)", 2.0, None),
            ("import time; time.sleep(30)", 0.1, None),
        )
        for script, timeout, expected in cases:
            with self.subTest(script=script), mock.patch.object(
                self.context, "_build_nmem_command",
                return_value=[sys.executable, "-c", script],
            ):
                for _ in range(5):
                    self.assertEqual(self.context._run_nmem_json(
                        "unused", [], timeout_seconds=timeout,
                    ), expected)
                    self.assertEqual(self.fd_count(), before)

    def test_detached_worker_closes_inherited_pipe(self):
        read_fd, write_fd = os.pipe()
        try:
            os.set_inheritable(write_fd, True)
            with subprocess.Popen(
                [sys.executable, "-c", "import time; time.sleep(30)"],
                **self.stop._background_spawn_kwargs(),
            ) as worker:
                try:
                    os.close(write_fd)
                    write_fd = None
                    os.set_blocking(read_fd, False)
                    # EOF while the worker is alive proves it did not retain this pipe.
                    self.assertIsNone(worker.poll())
                    self.assertEqual(os.read(read_fd, 1), b"")
                finally:
                    worker.terminate()
                    worker.wait(timeout=5)
        finally:
            os.close(read_fd)
            if write_fd is not None:
                os.close(write_fd)
