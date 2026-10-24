"""Exercise packaged Stop entrypoints with a read-only CLI transport double."""

from __future__ import annotations

import copy
import importlib.util
import io
import json
import os
import runpy
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "mailbox_core", ROOT / "shared/hooks/nmem_mailbox_stop.py"
)
CORE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CORE)


class MailboxStopTests(unittest.TestCase):
    host = "codex"

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="mailbox stop test ")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.event = {
            "hook_event_name": "Stop",
            "session_id": "session-1",
            "stop_hook_active": False,
        }
        self.selection = {
            "scope": {
                "store_id": "store",
                "store_incarnation": "incarnation",
                "workspace_id": None,
                "space_id": "research",
            },
            "address": {
                "agent_id": "reviewer",
                "custodian_id": "owner",
                "identity_birth": "birth",
                "attachment_id": "attachment",
                "attachment_generation": 1,
            },
        }
        self.binding = {
            "name": "reviewer",
            "configured": True,
            "state": "unverified",
            "validation": "unverified",
            "destination_id": "a" * 64,
            "revision": "b" * 64,
            "selection": self.selection,
        }
        self.pending = True
        self.token = "pending-state-1"
        self.calls = []
        self.requests = []
        self.shows = 0
        self.status_state = "usable"
        self.changed_binding = None
        self.summary_override = None
        self.failure = None
        self.env = {
            "USERPROFILE": str(self.root),
            "NMEM_AGENT_CONTEXT": "reviewer",
            "NMEM_CLI_PATH": sys.executable,
            "CODEX_HOME": str(self.root / "codex"),
            "CLAUDE_CONFIG_DIR": str(self.root / "claude"),
        }

    @property
    def wrapper(self):
        if self.host == "codex":
            return ROOT / "nowledge-mem-codex-plugin/hooks/nmem-mailbox-stop.py"
        return ROOT / "nowledge-mem-claude-code-plugin/scripts/nmem-hook-mailbox.py"

    def cli(self, command, deadline):
        self.calls.append(command)
        if self.failure is not None:
            return None
        args = command[1:]
        if args == ["--json", "agents", "context", "show", "--name", "reviewer"]:
            self.shows += 1
            reply = (
                self.changed_binding
                if self.shows > 1 and self.changed_binding is not None
                else self.binding
            )
        elif args == ["--json", "--agent-context", "reviewer", "mailbox", "status"]:
            reply = {
                "name": "reviewer",
                "configured": True,
                "validation": "live",
                "state": self.status_state,
                "selection": self.selection,
            }
        elif args[:4] == ["--json", "mailbox", "command", "--request-file"]:
            request = json.loads(Path(args[4]).read_text(encoding="utf-8"))
            self.requests.append(request)
            self.assertEqual(
                request, {"selection": self.selection, "operation": {"kind": "summary"}}
            )
            reply = self.summary_override or {
                "kind": "summary",
                "result": {
                    "has_pending": self.pending,
                    "change_token": self.token,
                    "observed_at": 123,
                    "body": "private-sender-text-must-not-be-injected",
                },
            }
        else:
            self.fail(f"Unexpected CLI operation: {args}")
        remaining = deadline - CORE.time.monotonic()
        self.assertGreater(remaining, 0)
        self.assertLessEqual(remaining, CORE.TOTAL_TIMEOUT_SECONDS)
        return reply

    def run_hook(self, wrapper=None):
        script = wrapper or self.wrapper
        output = io.StringIO()
        spec = importlib.util.spec_from_file_location(
            "nmem_mailbox_stop", script.with_name("nmem_mailbox_stop.py")
        )
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        # Use the packaged helper, replacing only its CLI transport. Real
        # launcher and process-resource tests exercise the other boundaries.
        with mock.patch.dict(os.environ, self.env, clear=True), mock.patch.dict(
            sys.modules, {"nmem_mailbox_stop": helper}
        ), mock.patch.object(sys, "path", list(sys.path)), mock.patch.object(
            sys, "stdin", io.StringIO(json.dumps(self.event))
        ), mock.patch.object(
            sys, "stdout", output
        ), mock.patch.object(
            helper, "_run_json", side_effect=self.cli
        ):
            runpy.run_path(str(script), run_name="__main__")
        return json.loads(output.getvalue())

    def test_pending_mail_produces_one_model_visible_non_consuming_check(self):
        response = self.run_hook()
        self.assertEqual(response.get("decision"), "block")
        self.assertIn('"mailbox", "inbox"', response["reason"])
        self.assertIn("NMEM_CLI_PATH", response["reason"])
        self.assertNotIn("private-sender-text", response["reason"])
        self.assertEqual(len(self.calls), 4)
        self.assertEqual(len(self.requests), 1)
        self.assertFalse(
            Path(self.calls[2][-1]).exists(), "temporary request must be reclaimed"
        )

    def test_same_pending_state_does_not_repeat_but_new_state_can_remind(self):
        self.assertEqual(self.run_hook()["decision"], "block")
        self.assertEqual(self.run_hook(), {})
        self.token = "pending-state-2"
        self.assertEqual(self.run_hook()["decision"], "block")

    def test_recursive_stop_and_other_events_never_probe(self):
        for patch in (
            {"stop_hook_active": True},
            {"stop_hook_active": "false"},
            {"hook_event_name": "Interrupt"},
            {"hook_event_name": "SessionEnd"},
            {"session_id": ""},
        ):
            with self.subTest(patch=patch):
                self.event.update(patch)
                self.assertEqual(self.run_hook(), {})
                self.assertEqual(self.calls, [])
                self.event = {
                    "hook_event_name": "Stop",
                    "session_id": "session-1",
                    "stop_hook_active": False,
                }

    def test_empty_or_unusable_mailbox_lets_stop_finish(self):
        self.pending = False
        self.assertEqual(self.run_hook(), {})
        self.pending = True
        self.status_state = "invalidated"
        self.assertEqual(self.run_hook(), {})
        self.assertEqual(len(self.requests), 1)

    def test_unconfigured_disabled_or_native_session_mode_never_probes_legacy_mail(
        self,
    ):
        for key, value in (
            ("NMEM_AGENT_CONTEXT", ""),
            ("NMEM_NO_MAILBOX_NOTICE", "1"),
            ("NMEM_BRIDGE_SESSION_MAILBOX", "1"),
            ("NMEM_CLI_PATH", str(self.root / "missing")),
        ):
            with self.subTest(variable=key):
                old = self.env[key] if key in self.env else None
                self.env[key] = value
                self.assertEqual(self.run_hook(), {})
                self.assertEqual(self.calls, [])
                if old is None:
                    del self.env[key]
                else:
                    self.env[key] = old

    def test_ambient_identity_and_exact_space_conflicts_never_probe_summary(self):
        for key, value in (
            ("NMEM_AGENT_ID", "other"),
            ("NMEM_SPACE", "other"),
            ("NMEM_SPACE_ID", "research "),
            ("NMEM_HOST_AGENT_ID", "alias"),
        ):
            with self.subTest(variable=key):
                self.env[key] = value
                self.assertEqual(self.run_hook(), {})
                self.assertEqual(self.requests, [])
                del self.env[key]

    def test_empty_whitespace_and_case_sensitive_space_ids_keep_exact_bytes(self):
        for space in ("", " ", "DEFAULT", "research "):
            with self.subTest(space=space):
                self.selection["scope"]["space_id"] = space
                self.env["NMEM_SPACE_ID"] = space
                self.token += "x"
                self.assertEqual(self.run_hook()["decision"], "block")
                self.assertEqual(
                    self.requests[-1]["selection"]["scope"]["space_id"], space
                )

    def test_reselection_after_summary_suppresses_stale_hint(self):
        self.changed_binding = copy.deepcopy(self.binding)
        self.changed_binding["revision"] = "c" * 64
        self.assertEqual(self.run_hook(), {})
        self.assertEqual(len(self.requests), 1)

    def test_wrong_generation_or_destination_never_inherits_a_notice(self):
        self.assertEqual(self.run_hook()["decision"], "block")
        self.selection["address"]["attachment_generation"] = 2
        self.binding["revision"] = "c" * 64
        self.assertEqual(self.run_hook()["decision"], "block")
        self.binding["destination_id"] = "d" * 64
        self.assertEqual(self.run_hook()["decision"], "block")

    def test_timeout_failure_and_malformed_summary_fail_open(self):
        self.failure = subprocess.TimeoutExpired("nmem", 1)
        self.assertEqual(self.run_hook(), {})
        self.failure = OSError("unavailable")
        self.assertEqual(self.run_hook(), {})
        self.failure = None
        for value in (
            {"kind": "sent", "result": {}},
            {
                "kind": "summary",
                "result": {"has_pending": "true", "change_token": "token"},
            },
            {
                "kind": "summary",
                "result": {"has_pending": True, "change_token": "x" * 129},
            },
        ):
            self.summary_override = value
            self.assertEqual(self.run_hook(), {})

    def test_installed_codex_fallback_shares_package_deduplication(self):
        if self.host != "codex":
            self.skipTest("Claude Code has no Codex host-level fallback")
        with mock.patch.dict(os.environ, self.env, clear=True):
            path = ROOT / "nowledge-mem-codex-plugin/scripts/install_hooks.py"
            spec = importlib.util.spec_from_file_location("mailbox_installer", path)
            installer = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(installer)
            installer.install_runtime_hook()
            installer.merge_hooks_json()
            installer.merge_hooks_json()
        hooks = json.loads(installer.GLOBAL_HOOKS_FILE.read_text())["hooks"]["Stop"]
        commands = [hook["command"] for entry in hooks for hook in entry["hooks"]]
        self.assertEqual(
            sum("nowledge-mem-mailbox-stop.py" in value for value in commands), 1
        )
        self.assertEqual(
            sum("nowledge-mem-stop-save.py" in value for value in commands), 1
        )
        installed = installer.HOOKS_DIR / "nowledge-mem-mailbox-stop.py"
        self.assertEqual(self.run_hook(installed)["decision"], "block")
        self.assertEqual(self.run_hook(), {})

    def test_unavailable_cache_does_not_block_stop(self):
        root = (
            self.root
            / ("codex" if self.host == "codex" else "claude")
            / "nowledge-mem/mailbox-stop"
        )
        root.mkdir(parents=True)
        (root / "mailbox-stop-v1.sqlite3").mkdir()
        self.assertEqual(self.run_hook(), {})


class ClaudeMailboxStopTests(MailboxStopTests):
    host = "claude-code"

    def test_shared_grok_package_does_not_enable_an_unqualified_host(self):
        self.env["GROK_PLUGIN_ROOT"] = "/synthetic/plugin"
        self.assertEqual(self.run_hook(), {})
        self.assertEqual(self.calls, [])


class MailboxStateTests(unittest.TestCase):
    def test_duplicate_sources_coordinate_one_notice_and_bound_the_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            CORE._claim_notice(root, "seed", "token")
            barrier = threading.Barrier(4)

            def claim(_):
                barrier.wait(timeout=5)
                try:
                    return CORE._claim_notice(root, "same-session", "same-token")
                except sqlite3.Error:
                    return False

            with ThreadPoolExecutor(max_workers=4) as pool:
                self.assertEqual(sum(pool.map(claim, range(4))), 1)
            for index in range(CORE.MAX_CACHE_ROWS + 5):
                CORE._claim_notice(root, str(index), "token")
            with closing(sqlite3.connect(root / "mailbox-stop-v1.sqlite3")) as database:
                self.assertEqual(
                    database.execute("SELECT count(*) FROM notices").fetchone()[0],
                    CORE.MAX_CACHE_ROWS,
                )

    def test_oversized_or_malformed_input_and_output_are_rejected(self):
        for value in ("[]", "bad-json", '"' + "x" * CORE.MAX_INPUT_BYTES + '"'):
            with mock.patch.object(sys, "stdin", io.StringIO(value)):
                self.assertEqual(CORE.read_event(), {})

    def test_both_packages_register_synchronous_mailbox_hooks_beside_capture(self):
        for package, script in (
            ("nowledge-mem-codex-plugin", "nmem-mailbox-stop.py"),
            ("nowledge-mem-claude-code-plugin", "nmem-hook-mailbox.py"),
        ):
            config = json.loads((ROOT / package / "hooks/hooks.json").read_text())
            hooks = [
                hook for entry in config["hooks"]["Stop"] for hook in entry["hooks"]
            ]
            self.assertTrue(
                any(
                    "nmem-stop-launch.py" in hook["command"]
                    or "nmem-hook-save.py" in hook["command"]
                    for hook in hooks
                )
            )
            notices = [hook for hook in hooks if script in hook["command"]]
            self.assertEqual(len(notices), 1)
            self.assertFalse(notices[0].get("async", False))
            self.assertEqual(notices[0]["timeout"], 5)
            if package == "nowledge-mem-codex-plugin":
                self.assertIn(script, notices[0]["commandWindows"])

    def test_real_launchers_work_from_an_unrelated_directory(self):
        with tempfile.TemporaryDirectory(prefix="mailbox launcher ") as directory:
            for package, script in (
                ("nowledge-mem-codex-plugin", "nmem-mailbox-stop.py"),
                ("nowledge-mem-claude-code-plugin", "nmem-hook-mailbox.py"),
            ):
                with self.subTest(package=package):
                    plugin = ROOT / package
                    config = json.loads((plugin / "hooks/hooks.json").read_text())
                    hook = next(
                        hook
                        for entry in config["hooks"]["Stop"]
                        for hook in entry["hooks"]
                        if script in hook["command"]
                    )
                    env = dict(
                        os.environ,
                        PLUGIN_ROOT=str(plugin),
                        CLAUDE_PLUGIN_ROOT=str(plugin),
                        NMEM_AGENT_CONTEXT="",
                        NMEM_CLI_PATH=str(Path(directory) / "missing"),
                        CODEX_HOME=directory,
                        CLAUDE_CONFIG_DIR=directory,
                    )
                    if package == "nowledge-mem-codex-plugin":
                        command = (
                            hook["commandWindows"]
                            if os.name == "nt"
                            else hook["command"]
                        )
                        shell = True
                    else:
                        command = [sys.executable, str(plugin / "scripts" / script)]
                        shell = False
                    result = subprocess.run(
                        command,
                        shell=shell,
                        cwd=directory,
                        env=env,
                        input='{"hook_event_name":"Stop","stop_hook_active":false,"session_id":"test"}',
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(json.loads(result.stdout), {})

    def test_packaged_helpers_match_canonical_source(self):
        source = (ROOT / "shared/hooks/nmem_mailbox_stop.py").read_bytes()
        for relative in (
            "nowledge-mem-codex-plugin/hooks/nmem_mailbox_stop.py",
            "nowledge-mem-claude-code-plugin/scripts/nmem_mailbox_stop.py",
        ):
            self.assertEqual((ROOT / relative).read_bytes(), source)


class MailboxProcessTests(unittest.TestCase):
    def test_runner_rejects_output_before_an_oversized_writer_finishes(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "finished"
            code = (
                "import sys; from pathlib import Path; "
                "sys.stdout.buffer.write(b'x' * (2 * 1024 * 1024)); "
                "sys.stdout.buffer.flush(); Path(sys.argv[1]).write_text('finished')"
            )
            result = CORE._run_json(
                [sys.executable, "-c", code, str(marker)], CORE.time.monotonic() + 5
            )
            self.assertIsNone(result)
            self.assertFalse(
                marker.exists(),
                "overflow must stop the writer before all output is spooled",
            )

    def _wait_for_exit(self, pid):
        if os.name == "nt":
            import ctypes
            from ctypes import wintypes

            kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel.OpenProcess.argtypes = [
                wintypes.DWORD,
                wintypes.BOOL,
                wintypes.DWORD,
            ]
            kernel.OpenProcess.restype = wintypes.HANDLE
            kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
            kernel.CloseHandle.argtypes = [wintypes.HANDLE]
            handle = kernel.OpenProcess(0x100000, False, pid)
            if not handle:
                return True
            try:
                return kernel.WaitForSingleObject(handle, 2000) == 0
            finally:
                kernel.CloseHandle(handle)
        deadline = CORE.time.monotonic() + 2
        while CORE.time.monotonic() < deadline:
            result = subprocess.run(
                ["ps", "-o", "stat=", "-p", str(pid)],
                capture_output=True,
                text=True,
                timeout=2,
            )
            state = result.stdout.strip()
            if not state or state.startswith("Z"):
                return True
            CORE.time.sleep(0.01)
        return False

    def test_runner_deadline_terminates_the_owned_descendant_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            child_pid = root / "child.pid"
            release = root / "release"
            marker = root / "after-timeout"
            child_code = (
                "import sys,time; from pathlib import Path; "
                "release=Path(sys.argv[1]); end=time.monotonic()+15\n"
                "while not release.exists() and time.monotonic()<end: time.sleep(0.01)\n"
                "if release.exists(): Path(sys.argv[2]).write_text('outlived probe')\n"
            )
            parent_code = (
                "import subprocess,sys,time; from pathlib import Path; "
                "child=subprocess.Popen([sys.executable,'-c',sys.argv[1],sys.argv[3],sys.argv[4]]); "
                "Path(sys.argv[2]).write_text(str(child.pid)); "
                "print('child-created',flush=True); time.sleep(60)"
            )
            clock = CORE.time.monotonic
            deadline = clock() + 5

            def after_child_creation():
                # Trigger the deadline only after the owned child exists.
                return deadline + 1 if child_pid.exists() else clock()

            try:
                with mock.patch.object(
                    CORE.time, "monotonic", side_effect=after_child_creation
                ):
                    result = CORE._run_json(
                        [
                            sys.executable,
                            "-c",
                            parent_code,
                            child_code,
                            str(child_pid),
                            str(release),
                            str(marker),
                        ],
                        deadline,
                    )
                self.assertIsNone(result)
                self.assertTrue(
                    child_pid.exists(), "the timeout must exercise a real descendant"
                )
                self.assertTrue(
                    self._wait_for_exit(int(child_pid.read_text())),
                    "descendant outlived the bounded probe",
                )
                self.assertFalse(marker.exists())
            finally:
                release.touch()
                if child_pid.exists():
                    self._wait_for_exit(int(child_pid.read_text()))


if __name__ == "__main__":
    unittest.main()
