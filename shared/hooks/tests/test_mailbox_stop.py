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

    def cli(self, command, **kwargs):
        self.calls.append(command)
        if self.failure is not None:
            raise self.failure
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
        self.assertGreater(kwargs["timeout"], 0)
        self.assertLessEqual(kwargs["timeout"], CORE.TOTAL_TIMEOUT_SECONDS)
        self.assertTrue(kwargs["close_fds"])
        kwargs["stdout"].write(json.dumps(reply).encode())
        return subprocess.CompletedProcess(command, 0)

    def run_hook(self, wrapper=None):
        script = wrapper or self.wrapper
        output = io.StringIO()
        # Reload the packaged helper: an installed package must stand alone.
        with mock.patch.dict(os.environ, self.env, clear=True), mock.patch.dict(
            sys.modules
        ), mock.patch.object(
            sys, "path", [str(script.parent), *sys.path]
        ), mock.patch.object(
            sys, "stdin", io.StringIO(json.dumps(self.event))
        ), mock.patch.object(
            sys, "stdout", output
        ), mock.patch.object(
            subprocess, "run", side_effect=self.cli
        ):
            sys.modules.pop("nmem_mailbox_stop", None)
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

        def oversized(command, **kwargs):
            kwargs["stdout"].write(b"x" * (CORE.MAX_OUTPUT_BYTES + 1))
            return subprocess.CompletedProcess(command, 0)

        with mock.patch.object(subprocess, "run", side_effect=oversized):
            self.assertIsNone(CORE._run_json(["nmem"], CORE.time.monotonic() + 1))

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

    def test_packaged_helpers_match_canonical_source(self):
        source = (ROOT / "shared/hooks/nmem_mailbox_stop.py").read_bytes()
        for relative in (
            "nowledge-mem-codex-plugin/hooks/nmem_mailbox_stop.py",
            "nowledge-mem-claude-code-plugin/scripts/nmem_mailbox_stop.py",
        ):
            self.assertEqual((ROOT / relative).read_bytes(), source)


if __name__ == "__main__":
    unittest.main()
