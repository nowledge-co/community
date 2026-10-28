"""Exercise packaged Stop entrypoints with a read-only CLI transport double."""

from __future__ import annotations

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
        self.pending = True
        self.incomplete = False
        self.token = "c" * 64
        self.binding_key = "a" * 64
        self.kind = "compatibility"
        self.calls = []
        self.response_override = None
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
        expected = [
            "--json",
            "--agent-context",
            "reviewer",
            "mailbox",
            "probe",
            "--host",
            self.host,
            "--session-id",
            "session-1",
        ]
        if self.env.get("NMEM_BRIDGE_SESSION_MAILBOX") == "1":
            expected.append("--native-session")
        self.assertEqual(args, expected)
        inspect = ["--json", "--agent-context", "reviewer", "mailbox"]
        if self.kind == "compatibility":
            inspect.extend(["inbox", "--limit", "20"])
        else:
            inspect.extend(
                [
                    "cloud-session" if self.kind == "cloud-session" else "session",
                    "--host",
                    self.host,
                    "--session-id",
                    "session-1",
                ]
            )
            inspect.extend(
                ["--space-id", "research", "receive"]
                if self.kind == "cloud-session"
                else ["inbox", "--limit", "20"]
            )
        reply = (
            self.response_override
            if self.response_override is not None
            else {
                "schema_version": 1,
                "context": "reviewer",
                "host": self.host,
                "session_id": "session-1",
                "mailbox_kind": self.kind,
                "has_pending": self.pending,
                "scan_incomplete": self.incomplete,
                "binding_key": self.binding_key,
                "change_token": self.token,
                "inspect_args": inspect,
                "body": "private-sender-text-must-not-be-injected",
            }
        )
        remaining = deadline - CORE.time.monotonic()
        self.assertGreater(remaining, 0)
        self.assertLessEqual(remaining, CORE.TOTAL_TIMEOUT_SECONDS)
        return reply

    def run_hook(self, wrapper=None, *, diagnose=False):
        script = wrapper or self.wrapper
        output = io.StringIO()
        spec = importlib.util.spec_from_file_location(
            "nmem_mailbox_stop", script.with_name("nmem_mailbox_stop.py")
        )
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        self.hook_diagnostics = []
        previous_trace = sys.gettrace()

        def trace(frame, event, value):
            if event == "exception" and Path(frame.f_code.co_filename).name in {
                script.name, "nmem_mailbox_stop.py", "nmem_runtime.py"
            }:
                kind, error, _ = value
                self.hook_diagnostics.append(
                    f"{Path(frame.f_code.co_filename).name}:{frame.f_lineno} {kind.__name__}: {error}"
                )
            return trace
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
            try:
                if diagnose:
                    sys.settrace(trace)
                runpy.run_path(str(script), run_name="__main__")
            finally:
                if diagnose:
                    sys.settrace(previous_trace)
        return json.loads(output.getvalue())

    def test_pending_mail_produces_one_model_visible_non_consuming_check(self):
        response = self.run_hook()
        self.assertEqual(response.get("decision"), "block")
        self.assertIn('"mailbox", "inbox"', response["reason"])
        self.assertIn("NMEM_CLI_PATH", response["reason"])
        self.assertNotIn("private-sender-text", response["reason"])
        self.assertEqual(len(self.calls), 1)

    def test_same_pending_state_does_not_repeat_but_new_state_can_remind(self):
        self.assertEqual(self.run_hook()["decision"], "block")
        self.assertEqual(self.run_hook(), {})
        self.token = "d" * 64
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

    def test_empty_or_unsupported_mailbox_lets_stop_finish(self):
        self.pending = False
        self.assertEqual(self.run_hook(), {})
        self.pending = True
        self.failure = OSError("unsupported probe capability")
        self.assertEqual(self.run_hook(), {})
        self.assertEqual(
            len(self.calls), 2, "one attempt per Stop; no compatibility fallback"
        )

    def test_posix_host_skips_windows_cli_before_any_mailbox_probe(self):
        with mock.patch.object(sys, "platform", "linux"):
            for suffix in (".cmd", ".bat", ".exe", ".CMD"):
                with self.subTest(suffix=suffix):
                    self.calls.clear()
                    executable = self.root / ("nmem" + suffix)
                    executable.write_text("", encoding="ascii")
                    executable.chmod(0o700)
                    self.env["NMEM_CLI_PATH"] = str(executable)
                    self.env["WSL_DISTRO_NAME"] = "test-distro"
                    self.assertEqual(self.run_hook(), {})
                    self.assertEqual(self.calls, [])
                    self.assertFalse(
                        (self.root / "codex/nowledge-mem/mailbox-stop").exists()
                    )
                    self.assertFalse(
                        (self.root / "claude/nowledge-mem/mailbox-stop").exists()
                    )

    def test_unconfigured_disabled_or_missing_cli_never_probes(
        self,
    ):
        for key, value in (
            ("NMEM_AGENT_CONTEXT", ""),
            ("NMEM_NO_MAILBOX_NOTICE", "1"),
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

    def test_native_unsupported_or_wrong_mailbox_never_falls_back(self):
        self.env["NMEM_BRIDGE_SESSION_MAILBOX"] = "1"
        self.failure = OSError("unsupported probe capability")
        self.assertEqual(self.run_hook(), {})
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.calls[0][-1], "--native-session")
        self.calls.clear()
        self.failure = None
        self.kind = "compatibility"
        self.assertEqual(self.run_hook(), {})
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.calls[0][-1], "--native-session")

    def test_native_backends_use_one_truthful_host_probe(self):
        self.env["NMEM_BRIDGE_SESSION_MAILBOX"] = "1"
        for kind in ("local-session", "cloud-session"):
            with self.subTest(kind=kind):
                self.kind = kind
                self.binding_key = ("1" if kind == "local-session" else "2") * 64
                response = self.run_hook()
                self.assertEqual(response["decision"], "block")
                self.assertIn('"--host", "' + self.host + '"', response["reason"])
                if kind == "cloud-session":
                    self.assertIn("--operation-id", response["reason"])
                    self.assertIn("automatically ACKs", response["reason"])
        self.assertEqual(len(self.calls), 2)

    def test_incomplete_observation_remains_explicit_with_or_without_pending(self):
        self.env["NMEM_BRIDGE_SESSION_MAILBOX"] = "1"
        self.incomplete = True
        for kind in ("local-session", "cloud-session"):
            for pending in (False, True):
                with self.subTest(kind=kind, pending=pending):
                    self.kind = kind
                    self.pending = pending
                    self.binding_key = ("1" if kind == "local-session" else "2") * 64
                    self.token = ("3" if pending else "4") * 64
                    response = self.run_hook()
                    self.assertEqual(response["decision"], "block")
                    self.assertIn("was incomplete", response["reason"])
                    self.assertEqual(
                        "has pending messages" in response["reason"], pending
                    )
                    self.assertEqual(self.run_hook(), {})

    def test_changed_binding_never_inherits_a_notice(self):
        self.assertEqual(self.run_hook()["decision"], "block")
        self.binding_key = "b" * 64
        self.assertEqual(self.run_hook()["decision"], "block")

    def test_timeout_failure_and_malformed_envelopes_fail_open(self):
        for failure in (subprocess.TimeoutExpired("nmem", 1), OSError("unavailable")):
            self.failure = failure
            self.assertEqual(self.run_hook(), {})
        self.failure = None
        baseline = self.cli(
            [
                sys.executable,
                "--json",
                "--agent-context",
                "reviewer",
                "mailbox",
                "probe",
                "--host",
                self.host,
                "--session-id",
                "session-1",
            ],
            CORE.time.monotonic() + 3,
        )
        for field, bad in (
            ("schema_version", True),
            ("schema_version", 2),
            ("context", "other"),
            ("host", "other"),
            ("session_id", "other"),
            ("mailbox_kind", "local-session"),
            ("mailbox_kind", {}),
            ("has_pending", "true"),
            ("scan_incomplete", 0),
            ("binding_key", "x" * 64),
            ("change_token", ""),
            ("inspect_args", ["--json", "mailbox", "receive"]),
        ):
            with self.subTest(field=field):
                self.response_override = dict(baseline, **{field: bad})
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
        response = self.run_hook(installed, diagnose=True)
        self.assertEqual(
            response.get("decision"), "block",
            f"installed launcher response={response!r}; transport_calls={len(self.calls)}; "
            f"handled_exceptions={self.hook_diagnostics!r}",
        )
        self.assertEqual(self.run_hook(), {})

    def test_unavailable_cache_does_not_block_stop(self):
        root = (
            self.root
            / ("codex" if self.host == "codex" else "claude")
            / "nowledge-mem/mailbox-stop"
        )
        root.mkdir(parents=True)
        (root / "mailbox-stop-v1.sqlite3").mkdir()
        self.assertEqual(self.run_hook(diagnose=True), {})
        self.assertTrue(
            any("OperationalError" in error for error in self.hook_diagnostics),
            self.hook_diagnostics,
        )


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

    def test_registered_native_launchers_invoke_only_one_probe(self):
        with tempfile.TemporaryDirectory(
            prefix="native mailbox launcher "
        ) as directory:
            root = Path(directory)
            script = root / "probe_cli.py"
            script.write_text(
                "import json, os, sys\nfrom pathlib import Path\n"
                "args = sys.argv[1:]\n"
                "with Path(os.environ['NMEM_PROBE_TEST_CALLS']).open('a') as log: log.write(json.dumps(args) + '\\n')\n"
                "context = args[args.index('--agent-context') + 1]\n"
                "host = args[args.index('--host') + 1]\n"
                "session = args[args.index('--session-id') + 1]\n"
                "print(json.dumps(dict(schema_version=1, context=context, host=host, session_id=session, "
                "mailbox_kind='cloud-session', has_pending=True, scan_incomplete=False, "
                "binding_key='a'*64, change_token='b'*64, "
                "inspect_args=['--json','--agent-context',context,'mailbox','cloud-session',"
                "'--host',host,'--session-id',session,'--space-id','research','receive'])))\n",
                encoding="utf-8",
            )
            executable = root / ("nmem.cmd" if os.name == "nt" else "nmem")
            executable.write_text(
                (
                    f'@"{sys.executable}" "{script}" %*\n'
                    if os.name == "nt"
                    else f'#!{sys.executable}\nexec(compile(open({str(script)!r}).read(), {str(script)!r}, "exec"))\n'
                ),
                encoding="utf-8",
            )
            executable.chmod(0o700)
            for package, entrypoint, host in (
                ("nowledge-mem-codex-plugin", "hooks/nmem-mailbox-stop.py", "codex"),
                (
                    "nowledge-mem-claude-code-plugin",
                    "scripts/nmem-hook-mailbox.py",
                    "claude-code",
                ),
            ):
                with self.subTest(host=host):
                    plugin = ROOT / package
                    hooks = json.loads((plugin / "hooks/hooks.json").read_text())[
                        "hooks"
                    ]["Stop"]
                    hook = next(
                        hook
                        for entry in hooks
                        for hook in entry["hooks"]
                        if Path(entrypoint).name in hook["command"]
                    )
                    calls = root / (host + ".jsonl")
                    env = dict(
                        os.environ,
                        PLUGIN_ROOT=str(plugin),
                        CLAUDE_PLUGIN_ROOT=str(plugin),
                        NMEM_AGENT_CONTEXT="reviewer",
                        NMEM_BRIDGE_SESSION_MAILBOX="1",
                        NMEM_CLI_PATH=str(executable),
                        NMEM_PROBE_TEST_CALLS=str(calls),
                        CODEX_HOME=str(root / host),
                        CLAUDE_CONFIG_DIR=str(root / host),
                    )
                    if os.name == "nt" and host == "claude-code":
                        command = [sys.executable, str(plugin / entrypoint)]
                        use_shell = False
                    else:
                        command = (
                            hook["commandWindows"]
                            if os.name == "nt"
                            else hook["command"]
                        )
                        use_shell = True
                    result = subprocess.run(
                        command,
                        shell=use_shell,
                        cwd=directory,
                        env=env,
                        input=json.dumps(
                            {
                                "hook_event_name": "Stop",
                                "stop_hook_active": False,
                                "session_id": "native",
                            }
                        ),
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(json.loads(result.stdout).get("decision"), "block")
                    observed = [
                        json.loads(line) for line in calls.read_text().splitlines()
                    ]
                    self.assertEqual(
                        observed,
                        [
                            [
                                "--json",
                                "--agent-context",
                                "reviewer",
                                "mailbox",
                                "probe",
                                "--host",
                                host,
                                "--session-id",
                                "native",
                                "--native-session",
                            ]
                        ],
                    )

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

    @staticmethod
    def _published_ids(path):
        try:
            value = json.loads(path.read_text())
            if set(value) == {"parent", "child"} and all(
                type(pid) is int and pid > 0 for pid in value.values()
            ):
                return value
        except (OSError, ValueError, TypeError):
            pass
        return None

    def _has_exited(self, pid):
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
                return kernel.WaitForSingleObject(handle, 0) == 0
            finally:
                kernel.CloseHandle(handle)
        result = subprocess.run(
            ["ps", "-o", "stat=", "-p", str(pid)],
            capture_output=True,
            text=True,
            timeout=2,
        )
        state = result.stdout.strip()
        return not state or state.startswith("Z")

    def test_fixture_waits_for_complete_atomic_pid_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            published = Path(directory) / "processes.json"
            temporary = published.with_suffix(".tmp")
            temporary.touch()
            self.assertIsNone(self._published_ids(published))
            published.touch()
            self.assertIsNone(self._published_ids(published))
            temporary.write_text('{"parent":11,"child":12}')
            self.assertIsNone(self._published_ids(published))
            temporary.replace(published)
            self.assertEqual(
                self._published_ids(published), {"parent": 11, "child": 12}
            )

    def test_runner_preserves_valid_unicode_json_before_reaping_its_owner(self):
        value = {"value": "snow-\u96ea", "ok": True}
        code = "import sys; sys.stdout.buffer.write(sys.argv[1].encode('utf-8'))"
        owners = []
        terminate = CORE._terminate_tree

        def cleanup(process):
            owners.append(process.returncode)
            terminate(process)

        with mock.patch.object(CORE, "_terminate_tree", side_effect=cleanup):
            result = CORE._run_json(
                [sys.executable, "-c", code, json.dumps(value, ensure_ascii=False)],
                CORE.time.monotonic() + 5,
            )
        self.assertEqual(result, value)
        self.assertEqual(
            owners, [None], "the group owner must not be reaped before cleanup"
        )
        failed = CORE._run_json(
            [sys.executable, "-c", "print('{}'); raise SystemExit(1)"],
            CORE.time.monotonic() + 5,
        )
        self.assertIsNone(failed)

    def test_guardian_watchdog_reclaims_children_without_parent_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            published = root / "processes.json"
            packet, status = root / "command.json", root / "status"
            code = (
                "import json,os,subprocess,sys,time; from pathlib import Path; "
                "child=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']); "
                "target=Path(sys.argv[1]); tmp=target.with_suffix('.tmp'); "
                "tmp.write_text(json.dumps({'parent':os.getpid(),'child':child.pid})); "
                "tmp.replace(target); time.sleep(60)"
            )
            packet.write_text(
                json.dumps(
                    {
                        "command": [sys.executable, "-c", code, str(published)],
                        "lifetime": 2,
                    }
                )
            )
            kwargs = (
                {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)}
                if os.name == "nt"
                else {"start_new_session": True}
            )
            owner = subprocess.Popen(
                [
                    sys.executable,
                    str(Path(CORE.__file__).resolve()),
                    "--owned-probe",
                    str(packet),
                    str(status),
                ],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                **kwargs,
            )
            try:
                owner.wait(timeout=5)
                ids = self._published_ids(published)
                self.assertIsNotNone(
                    ids, "the watchdog must exercise an owned live tree"
                )
                self.assertTrue(self._wait_for_exit(ids["parent"]))
                self.assertTrue(self._wait_for_exit(ids["child"]))
            finally:
                if owner.returncode is None:
                    CORE._terminate_tree(owner)

    def test_runner_deadline_terminates_the_owned_descendant_tree(self):
        for leader_exits_first in (False, True):
            with self.subTest(
                leader_exits_first=leader_exits_first
            ), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                published = root / "processes.json"
                release, marker = root / "release", root / "after-timeout"
                child_code = (
                    "import sys,time; from pathlib import Path; "
                    "release=Path(sys.argv[1]); end=time.monotonic()+15\n"
                    "while not release.exists() and time.monotonic()<end: time.sleep(0.01)\n"
                    "if release.exists(): Path(sys.argv[2]).write_text('outlived probe')\n"
                )
                parent_code = (
                    "import json,os,subprocess,sys,time; from pathlib import Path; "
                    "child=subprocess.Popen([sys.executable,'-c',sys.argv[1],sys.argv[3],sys.argv[4]]); "
                    "target=Path(sys.argv[2]); tmp=target.with_suffix('.tmp'); "
                    "tmp.write_text(json.dumps({'parent':os.getpid(),'child':child.pid})); tmp.replace(target); "
                    "print('child-created',flush=True); "
                    + (
                        "raise SystemExit(0)"
                        if leader_exits_first
                        else "time.sleep(60)"
                    )
                )
                clock = CORE.time.monotonic
                deadline = clock() + 5

                def after_child_creation():
                    ids = self._published_ids(published)
                    if ids and (
                        not leader_exits_first or self._has_exited(ids["parent"])
                    ):
                        return deadline + 1
                    return clock()

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
                                str(published),
                                str(release),
                                str(marker),
                            ],
                            deadline,
                        )
                    self.assertIsNone(result)
                    ids = self._published_ids(published)
                    self.assertIsNotNone(
                        ids, "the timeout must exercise a published real descendant"
                    )
                    self.assertTrue(
                        self._wait_for_exit(ids["child"]),
                        "descendant outlived the bounded probe",
                    )
                    self.assertTrue(self._wait_for_exit(ids["parent"]))
                    self.assertFalse(marker.exists())
                finally:
                    release.touch()
                    ids = self._published_ids(published)
                    if ids:
                        self._wait_for_exit(ids["child"])


if __name__ == "__main__":
    unittest.main()
