import importlib.util
import json
import os
from pathlib import Path
import shlex
from unittest import mock
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "bridge_notice_cache", Path(__file__).parents[1] / "nmem_bridge_notice.py"
)
NOTICE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NOTICE)


def capture_owned(command, *, env, payload):
    process = subprocess.Popen(
        command,
        shell=isinstance(command, str),
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        stdout, stderr = process.communicate(payload, timeout=1)
        return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
    except subprocess.TimeoutExpired:
        # Retain the parent's process handle until its whole owned tree has
        # terminated; do not leave a pipe-holding Python after cmd times out.
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=2,
                check=False,
            )
        process.kill()
        process.communicate(timeout=1)
        raise


def windows_launch_diagnostics(env):
    code = "import sys; print(sys.executable, flush=True); print(sys.version, flush=True); print(len(sys.stdin.buffer.read()), flush=True)"
    diagnostics = []
    for command in (
        [sys.executable, "-c", code],
        subprocess.list2cmdline(["py", "-3", "-c", code]),
        subprocess.list2cmdline(["python", "-c", code]),
    ):
        try:
            result = capture_owned(command, env=env, payload="fixture")
            diagnostics.append(
                (command, result.returncode, result.stdout, result.stderr)
            )
        except subprocess.TimeoutExpired as error:
            diagnostics.append((command, "timeout", error.stdout, error.stderr))
    return diagnostics


class CacheNoticeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.directory = self.root / "bridge-notices-v1"
        self.directory.mkdir(mode=0o700)
        self.now = 1_000_000
        self.key = "1" * 64
        self.target = {
            "host": "codex",
            "session_id": "actual-session",
            "native": False,
            "record": {"name": "approved", "revision": "a" * 64},
        }
        self.value = {
            "schema_version": 1,
            "config_fence": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "state": "fresh",
            "has_pending": True,
            "scan_incomplete": False,
            "host": "codex",
            "session_id": "actual-session",
            "context": "approved",
            "context_revision": "a" * 64,
            "binding_key": "b" * 64,
            "observer_binding_key": "b" * 64,
            "identity_key": "e" * 64,
            "change_token": "c" * 64,
            "mailbox_kind": "identity",
            "saved_ms": self.now,
            "expires_ms": self.now + 45_000,
        }
        self.save()

    def save(self):
        (self.directory / "enabled").write_text("{}")
        (self.directory / "subscriptions.json").write_text(
            json.dumps({self.key: self.target})
        )
        (self.directory / f"{self.key}.json").write_text(json.dumps(self.value))
        for path in self.directory.glob("*.json"):
            path.chmod(0o600)
        (self.directory / "enabled").chmod(0o600)

    def response(self, event="Stop", **extra):
        return NOTICE.response(
            {
                "hook_event_name": event,
                "session_id": "actual-session",
                "stop_hook_active": False,
                **extra,
            },
            host="codex",
            root=self.root,
            environ={},
            now_ms=self.now,
        )

    def test_correlated_reply_reaches_only_its_session_without_a_role_subscription(self):
        import hashlib
        session = self.target["session_id"]
        key = hashlib.sha256(json.dumps(["codex", session], separators=(",", ":")).encode()).hexdigest()
        token = "a" * 64
        args = ["--return-host=codex", "bridge", "notices", "open-reply", token]
        snapshot = {"schema_version": 1, "host": "codex", "session_id": session,
                    "config_fence": self.value["config_fence"], "saved_ms": self.now,
                    "expires_ms": self.now + 45_000,
                    "replies": [{"token": token, "open_args": args, "expires_ms": self.now + 45_000}]}
        path = self.directory / f"replies-{key}.json"
        (self.directory / "subscriptions.json").unlink()
        def save(value):
            path.write_text(json.dumps(value))
            path.chmod(0o600)
        for changes in ({"expires_ms": self.now}, {"config_fence": "a" * 64},
                        {"host": "claude-code"}, {"session_id": "other"},
                        {"replies": [dict(snapshot["replies"][0], expires_ms=self.now)]},
                        {"replies": [{"token": token, "open_args": ["bridge", "send"]}]}):
            save(dict(snapshot, **changes))
            self.assertEqual(self.response(), {})
        save(snapshot)
        self.assertEqual(self.response("UserPromptSubmit", session_id="other"), {})
        hint = self.response("UserPromptSubmit")["hookSpecificOutput"]["additionalContext"]
        self.assertIn(json.dumps(args), hint)
        self.assertEqual(self.response("PostToolUse"), {})

    def test_automatically_paired_role_does_not_notify_an_unrelated_window(self):
        self.value["model_notice_scope"] = "session_replies_only"
        self.save()
        self.assertEqual(self.response("UserPromptSubmit"), {})
        del self.value["model_notice_scope"]
        self.save()
        self.assertIn("additionalContext", self.response("UserPromptSubmit")["hookSpecificOutput"])

    def test_model_hooks_share_tokens_and_keep_sessions_independent(self):
        self.assertEqual(self.response()["decision"], "block")
        self.assertEqual(self.response(), {})
        self.value["change_token"] = "d" * 64
        self.save()
        self.assertEqual(self.response()["decision"], "block")
        self.value["change_token"] = "c" * 64
        self.save()
        self.assertEqual(
            self.response(),
            {},
            "a previously seen token cannot remind again after a transient observation",
        )
        self.assertEqual(self.response("UserPromptSubmit"), {})
        self.value["change_token"] = "f" * 64
        self.save()
        self.assertIn(
            "additionalContext", self.response("UserPromptSubmit")["hookSpecificOutput"]
        )
        self.assertEqual(self.response("PostToolUse"), {})
        self.assertEqual(self.response(), {})
        self.assertEqual(self.response(stop_hook_active=True), {})
        self.assertEqual(self.response(session_id="another-session"), {})

    def test_ending_and_resuming_the_same_session_preserves_seen_tokens(self):
        self.assertEqual(self.response()["decision"], "block")
        (self.directory / "subscriptions.json").write_text("{}")
        self.assertEqual(self.response(), {})
        self.save()
        self.assertEqual(self.response(), {})
        self.value["change_token"] = "f" * 64
        self.save()
        self.assertEqual(self.response()["decision"], "block")

    def test_stale_unavailable_changed_binding_and_wrong_mailbox_kind_are_quiet(self):
        for change in [
            {"expires_ms": self.now},
            {"saved_ms": self.now + 1},
            {"state": "unavailable"},
            {"context_revision": "e" * 64},
            {"binding_key": "invalid"},
            {"mailbox_kind": "cloud-session"},
        ]:
            with self.subTest(change=change):
                original = self.value.copy()
                self.value.update(change)
                self.save()
                self.assertEqual(self.response(), {})
                self.value = original

    def test_missing_or_corrupt_consumer_does_not_hide_a_valid_session(self):
        broken = "0" * 64
        (self.directory / "subscriptions.json").write_text(
            json.dumps({broken: self.target, self.key: self.target})
        )
        (self.directory / f"{broken}.json").write_text("broken")
        self.assertEqual(self.response()["decision"], "block")

    def test_invalid_native_kind_does_not_hide_a_valid_identity_consumer(self):
        broken = "0" * 64
        (self.directory / "subscriptions.json").write_text(
            json.dumps({broken: {**self.target, "native": True}, self.key: self.target})
        )
        (self.directory / f"{broken}.json").write_text(
            json.dumps({**self.value, "mailbox_kind": []})
        )
        (self.directory / f"{broken}.json").chmod(0o600)
        self.assertEqual(self.response()["decision"], "block")

    def test_excessive_json_depth_does_not_hide_a_valid_consumer(self):
        broken = "0" * 64
        (self.directory / "subscriptions.json").write_text(
            json.dumps({broken: self.target, self.key: self.target})
        )
        path = self.directory / f"{broken}.json"
        path.write_text("[" * 2000 + "]" * 2000)
        path.chmod(0o600)
        self.assertEqual(self.response()["decision"], "block")

    def test_configuration_fence_refuses_oversized_and_nonregular_files_before_open(
        self,
    ):
        path = self.root / "config.json"
        path.write_bytes(b"x" * (1024 * 1024 + 1))
        with mock.patch.object(
            NOTICE.os, "open", side_effect=AssertionError("must reject before opening")
        ):
            with self.assertRaises(ValueError):
                NOTICE._configuration_fence(path)
        path.unlink()
        if os.name != "nt":
            os.mkfifo(path)
            with mock.patch.object(
                NOTICE.os,
                "open",
                side_effect=AssertionError("must reject before opening"),
            ):
                with self.assertRaises(ValueError):
                    NOTICE._configuration_fence(path)

    def test_all_grok_runtime_markers_exclude_the_actual_claude_wrapper(self):
        import time

        self.target["host"] = self.value["host"] = "claude-code"
        self.value.update(
            saved_ms=int(time.time() * 1000),
            expires_ms=int(time.time() * 1000) + 45_000,
        )
        self.save()
        markers = {
            "GROK_SESSION_ID": "grok-session",
            "GROK_HOOK_EVENT": "Stop",
            "GROK_WORKSPACE_ROOT": "workspace",
            "GROK_PLUGIN_ROOT": "plugin",
            "CLAUDE_PLUGIN_ROOT": "C:\\Users\\fixture\\.grok\\plugins\\mem",
        }
        script = ROOT / "nowledge-mem-claude-code-plugin/scripts/nmem-hook-mailbox.py"
        for marker, value in markers.items():
            env = {
                key: value for key, value in os.environ.items() if key not in markers
            }
            env.update({marker: value, "NMEM_CLI_CONFIG_DIR": str(self.root)})
            result = subprocess.run(
                [sys.executable, str(script)],
                input=json.dumps(
                    {
                        "hook_event_name": "Stop",
                        "stop_hook_active": False,
                        "session_id": "actual-session",
                    }
                ),
                env=env,
                text=True,
                capture_output=True,
                timeout=1,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), {}, marker)

    def test_post_tool_use_rate_limit_does_not_consume_the_next_token(self):
        self.assertIn(
            "additionalContext", self.response("PostToolUse")["hookSpecificOutput"]
        )

        self.value["change_token"] = "d" * 64
        self.save()
        self.assertEqual(self.response("PostToolUse"), {})
        self.now += 120_000
        self.value.update(saved_ms=self.now, expires_ms=self.now + 45_000)
        self.save()
        self.assertIn(
            "additionalContext", self.response("PostToolUse")["hookSpecificOutput"]
        )

    def test_native_session_guidance_keeps_local_and_cloud_separate(self):
        for kind, verb in [("local-session", "mailbox"), ("cloud-session", "bridge")]:
            with self.subTest(kind=kind):
                self.target["native"] = True
                self.value["mailbox_kind"] = kind
                self.save()
                response = self.response()
                self.assertEqual(response["decision"], "block")
                self.assertIn(
                    json.dumps(
                        [
                            "--agent-context=approved",
                            verb,
                            "session",
                            "--host=codex",
                            "--session-id=actual-session",
                            "inbox",
                        ]
                    ),
                    response["reason"],
                )

    @unittest.skipIf(os.name == "nt", "POSIX fixture executable")
    def test_packaged_lifecycle_only_releases_the_actual_ended_session(self):
        counter = self.root / "lifecycle.json"
        executable = self.root / "fake-nmem"
        executable.write_text(
            "#!/bin/sh\nprintf '%s\\n' \"$@\" END >> "
            + shlex.quote(str(counter))
            + "\n"
        )
        executable.chmod(0o700)
        for package, script, host in [
            ("nowledge-mem-codex-plugin", "hooks/nmem-mailbox-stop.py", "codex"),
            (
                "nowledge-mem-claude-code-plugin",
                "scripts/nmem-hook-mailbox.py",
                "claude-code",
            ),
        ]:
            env = {
                **os.environ,
                "NMEM_CLI_CONFIG_DIR": str(self.root),
                "NMEM_CLI_PATH": str(executable),
            }
            env.pop("GROK_PLUGIN_ROOT", None)
            counter.unlink(missing_ok=True)
            result = subprocess.run(
                [sys.executable, str(ROOT / package / script)],
                input=json.dumps(
                    {"hook_event_name": "SessionEnd", "session_id": "actual-session"}
                ),
                env=env,
                text=True,
                capture_output=True,
                timeout=2,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                counter.read_text().splitlines(),
                [
                    "--json",
                    "bridge",
                    "notices",
                    "unsubscribe",
                    f"--host={host}",
                    "--session-id=actual-session",
                    "--ended",
                    "END",
                ],
            )

        installer_path = ROOT / "nowledge-mem-codex-plugin/scripts/install_hooks.py"
        spec = importlib.util.spec_from_file_location(
            "lifecycle_installer", installer_path
        )
        installer = importlib.util.module_from_spec(spec)
        with mock.patch.dict(
            os.environ, {"CODEX_HOME": str(self.root / "codex-fallback")}, clear=False
        ):
            spec.loader.exec_module(installer)
            installer.install_runtime_hook()
            installer.merge_hooks_json()
        groups = json.loads(installer.GLOBAL_HOOKS_FILE.read_text())["hooks"][
            "SessionEnd"
        ]
        command = next(
            hook["command"]
            for group in groups
            for hook in group["hooks"]
            if "nowledge-mem-mailbox-stop.py" in hook.get("command", "")
        )
        env.pop("PLUGIN_ROOT", None)
        env["CODEX_HOME"] = str(installer.GLOBAL_HOOKS_FILE.parent)
        counter.unlink(missing_ok=True)
        subprocess.run(
            ["/bin/sh", "-c", command],
            input=json.dumps(
                {"hook_event_name": "SessionEnd", "session_id": "actual-session"}
            ),
            env=env,
            text=True,
            capture_output=True,
            timeout=2,
            check=True,
        )
        self.assertEqual(
            counter.read_text().splitlines(),
            [
                "--json",
                "bridge",
                "notices",
                "unsubscribe",
                "--host=codex",
                "--session-id=actual-session",
                "--ended",
                "END",
            ],
        )

    @unittest.skipIf(os.name == "nt", "POSIX configured lifecycle launcher")
    def test_disabled_bridge_keeps_only_the_ended_session_cleanup_gate(self):
        counter = self.root / "disabled-end-calls"
        executable = self.root / "fake-nmem"
        executable.write_text(
            "#!/bin/sh\nprintf '%s\\n' \"$@\" END >> "
            + shlex.quote(str(counter))
            + "\n"
        )
        executable.chmod(0o700)
        (self.directory / "enabled").unlink()
        for package, marker, host in [
            ("nowledge-mem-codex-plugin", "nmem-mailbox-stop.py", "codex"),
            ("nowledge-mem-claude-code-plugin", "nmem-hook-mailbox.py", "claude-code"),
        ]:
            hooks = json.loads((ROOT / package / "hooks/hooks.json").read_text())[
                "hooks"
            ]
            env = {
                key: value
                for key, value in os.environ.items()
                if not key.startswith("GROK_")
            }
            env.update(
                PLUGIN_ROOT=str(ROOT / package),
                CLAUDE_PLUGIN_ROOT=str(ROOT / package),
                NMEM_CLI_CONFIG_DIR=str(self.root),
                NMEM_CLI_PATH=str(executable),
            )
            counter.unlink(missing_ok=True)
            command = next(
                hook["command"]
                for group in hooks["SessionEnd"]
                for hook in group["hooks"]
                if marker in hook.get("command", "")
            )
            result = subprocess.run(
                ["/bin/sh", "-c", command],
                env=env,
                input=json.dumps(
                    {"hook_event_name": "SessionEnd", "session_id": "actual-session"}
                ),
                capture_output=True,
                text=True,
                timeout=1,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                counter.read_text().splitlines(),
                [
                    "--json",
                    "bridge",
                    "notices",
                    "unsubscribe",
                    f"--host={host}",
                    "--session-id=actual-session",
                    "--ended",
                    "END",
                ],
            )
            counter.unlink()
            command = next(
                hook["command"]
                for group in hooks["Stop"]
                for hook in group["hooks"]
                if marker in hook.get("command", "")
            )
            result = subprocess.run(
                ["/bin/sh", "-c", command],
                env=env,
                input="{}",
                capture_output=True,
                text=True,
                timeout=1,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(counter.exists())

    @unittest.skipIf(
        os.name == "nt",
        "POSIX sentinel contract; Windows has a separate command regression",
    )
    def test_registered_launchers_start_no_interpreter_when_unconfigured(self):
        shims = self.root / "bin"
        shims.mkdir()
        counter = self.root / "interpreter-started"
        for executable in ("python3", "python", "py", "nmem"):
            shim = shims / executable
            shim.write_text(
                "#!/bin/sh\n: > " + shlex.quote(str(counter)) + "\nexit 77\n"
            )
            shim.chmod(0o700)
        empty = self.root / "unconfigured"
        for package, marker in [
            ("nowledge-mem-codex-plugin", "nmem-mailbox-stop.py"),
            ("nowledge-mem-claude-code-plugin", "nmem-hook-mailbox.py"),
        ]:
            hooks = json.loads((ROOT / package / "hooks/hooks.json").read_text())[
                "hooks"
            ]
            for event in ("Stop", "UserPromptSubmit", "PostToolUse", "SessionEnd"):
                entry = next(
                    hook
                    for group in hooks[event]
                    for hook in group["hooks"]
                    if marker in hook.get("command", "")
                )
                env = {
                    **os.environ,
                    "PATH": str(shims),
                    "NMEM_CLI_CONFIG_DIR": str(empty),
                }
                result = subprocess.run(
                    ["/bin/sh", "-c", entry["command"]],
                    env=env,
                    input="{}",
                    text=True,
                    capture_output=True,
                    timeout=1,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertFalse(counter.exists(), (package, event))

    def test_configured_launchers_keep_identity_native_and_model_events_network_free(
        self,
    ):
        import time

        marker = self.root / "nmem-started"
        executable = self.root / "nmem"
        executable.write_text(
            "#!/bin/sh\n: > " + shlex.quote(str(marker)) + "\nexit 77\n"
        )
        executable.chmod(0o700)
        counter = 0
        for package, script, host in [
            ("nowledge-mem-codex-plugin", "hooks/nmem-mailbox-stop.py", "codex"),
            (
                "nowledge-mem-claude-code-plugin",
                "scripts/nmem-hook-mailbox.py",
                "claude-code",
            ),
        ]:
            hooks = json.loads((ROOT / package / "hooks/hooks.json").read_text())[
                "hooks"
            ]
            for kind in ("identity", "local-session", "cloud-session"):
                for event in ("UserPromptSubmit", "PostToolUse", "Stop"):
                    counter += 1
                    self.target.update(host=host, native=kind != "identity")
                    now = int(time.time() * 1000)
                    self.value.update(
                        host=host,
                        mailbox_kind=kind,
                        change_token=format(counter, "064x"),
                        saved_ms=now,
                        expires_ms=now + 45_000,
                    )
                    self.save()
                    ledger = self.directory / "hook-ledger.sqlite3"
                    ledger.unlink(missing_ok=True)
                    entry = next(
                        hook
                        for group in hooks[event]
                        for hook in group["hooks"]
                        if Path(script).name in hook.get("command", "")
                    )
                    env = {
                        key: value
                        for key, value in os.environ.items()
                        if not key.startswith("GROK_") and key != "CLAUDE_PLUGIN_ROOT"
                    }
                    env.update(
                        PLUGIN_ROOT=str(ROOT / package),
                        CLAUDE_PLUGIN_ROOT=str(ROOT / package),
                        NMEM_CLI_CONFIG_DIR=str(self.root),
                        NMEM_CLI_PATH=str(executable),
                    )
                    command = (
                        entry.get("commandWindows")
                        if os.name == "nt"
                        else ["/bin/sh", "-c", entry["command"]]
                    )
                    command = command or [sys.executable, str(ROOT / package / script)]
                    try:
                        result = capture_owned(
                            command,
                            env=env,
                            payload=json.dumps(
                                {
                                    "hook_event_name": event,
                                    "session_id": "actual-session",
                                    "stop_hook_active": False,
                                }
                            ),
                        )
                    except subprocess.TimeoutExpired as error:
                        # Preserve the same deadline oracle and identify the actual
                        # failing launch boundary without touching a real mailbox.
                        self.fail(
                            f"{package}/{kind}/{event}: configured launch exceeded 1s; stdout={error.stdout!r}; stderr={error.stderr!r}; controls={windows_launch_diagnostics(env) if os.name == 'nt' else []!r}"
                        )
                    self.assertEqual(
                        result.returncode, 0, (package, kind, event, result.stderr)
                    )
                    value = json.loads(result.stdout)
                    self.assertEqual(
                        value.get("decision"), "block" if event == "Stop" else None
                    )
                    hint = (
                        value["reason"]
                        if event == "Stop"
                        else value["hookSpecificOutput"]["additionalContext"]
                    )
                    self.assertIn(
                        (
                            '"bridge", "inbox"'
                            if kind == "identity"
                            else '"session", "--host=' + host + '"'
                        ),
                        hint,
                    )
                    self.assertFalse(marker.exists(), (package, kind, event))

    @unittest.skipUnless(os.name == "nt", "Native cmd.exe contract")
    def test_windows_registration_gates_all_events_before_python(self):
        empty = self.root / "unconfigured"
        empty.mkdir()
        counter = self.root / "interpreter-calls"
        for name in ("py", "python", "python3"):
            (empty / (name + ".cmd")).write_text(
                '@echo started>>"%NMEM_TEST_INTERPRETER_CALLS%"\n@exit /b 0\n'
            )
        hooks = json.loads(
            (ROOT / "nowledge-mem-codex-plugin/hooks/hooks.json").read_text()
        )["hooks"]
        env = {
            **os.environ,
            "NMEM_CLI_CONFIG_DIR": str(empty),
            "PATH": str(empty),
            "NMEM_TEST_INTERPRETER_CALLS": str(counter),
        }
        for event in ("Stop", "UserPromptSubmit", "PostToolUse", "SessionEnd"):
            entry = next(
                hook
                for group in hooks[event]
                for hook in group["hooks"]
                if "nmem-mailbox-stop.py" in hook.get("commandWindows", "")
            )
            result = subprocess.run(
                entry["commandWindows"],
                shell=True,
                env=env,
                capture_output=True,
                text=True,
                timeout=2,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, "")
            self.assertFalse(counter.exists())

    @unittest.skipUnless(os.name == "nt", "Native cmd.exe configured-path contract")
    def test_windows_configured_paths_start_exactly_one_interpreter(self):
        shims = self.root / "bin"
        shims.mkdir()
        counter = self.root / "interpreter-calls"
        for name in ("py", "python", "python3"):
            (shims / (name + ".cmd")).write_text(
                '@echo started>>"%NMEM_TEST_INTERPRETER_CALLS%"\n@exit /b 0\n'
            )
        hooks = json.loads(
            (ROOT / "nowledge-mem-codex-plugin/hooks/hooks.json").read_text()
        )["hooks"]
        profile = self.root / "profile with (parentheses)"
        custom = self.root / "config with (parentheses)"
        for config in (profile / ".nowledge-mem", custom):
            state = config / "bridge-notices-v1"
            state.mkdir(parents=True)
            (state / "enabled").write_text("{}")
            (state / "subscriptions.json").write_text("{}")
            env = {
                **os.environ,
                "PATH": str(shims),
                "USERPROFILE": str(profile),
                "NMEM_TEST_INTERPRETER_CALLS": str(counter),
            }
            env.pop("NMEM_CLI_CONFIG_DIR", None)
            if config == custom:
                env["NMEM_CLI_CONFIG_DIR"] = str(custom)
            for event in ("Stop", "UserPromptSubmit", "PostToolUse", "SessionEnd"):
                counter.unlink(missing_ok=True)
                if event == "SessionEnd":
                    (state / "enabled").unlink()
                entry = next(
                    hook
                    for group in hooks[event]
                    for hook in group["hooks"]
                    if "nmem-mailbox-stop.py" in hook.get("commandWindows", "")
                )
                result = subprocess.run(
                    entry["commandWindows"],
                    shell=True,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(
                    counter.read_text().splitlines(),
                    ["started"],
                    (config, event, result.stderr),
                )

    def test_installed_fallback_and_package_share_cached_token(self):
        path = ROOT / "nowledge-mem-codex-plugin/scripts/install_hooks.py"
        spec = importlib.util.spec_from_file_location("cached_notice_installer", path)
        installer = importlib.util.module_from_spec(spec)
        with mock.patch.dict(
            os.environ, {"CODEX_HOME": str(self.root / "codex")}, clear=False
        ):
            spec.loader.exec_module(installer)
            installer.install_runtime_hook()
            installer.merge_hooks_json()
            installer.merge_hooks_json()
        commands = [
            hook["command"]
            for group in json.loads(installer.GLOBAL_HOOKS_FILE.read_text())["hooks"][
                "Stop"
            ]
            for hook in group["hooks"]
        ]
        self.assertEqual(
            sum("nowledge-mem-mailbox-stop.py" in command for command in commands), 1
        )
        import time

        self.value.update(
            saved_ms=int(time.time() * 1000),
            expires_ms=int(time.time() * 1000) + 45_000,
        )
        self.save()
        env = {**os.environ, "NMEM_CLI_CONFIG_DIR": str(self.root)}
        env.pop("NMEM_AGENT_CONTEXT", None)
        event = json.dumps(
            {
                "hook_event_name": "Stop",
                "session_id": "actual-session",
                "stop_hook_active": False,
            }
        )
        for script, expected in [
            (installer.HOOKS_DIR / "nowledge-mem-mailbox-stop.py", "block"),
            (ROOT / "nowledge-mem-codex-plugin/hooks/nmem-mailbox-stop.py", None),
        ]:
            result = subprocess.run(
                [sys.executable, str(script)],
                env=env,
                input=event,
                text=True,
                capture_output=True,
                timeout=2,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout).get("decision"), expected)


if __name__ == "__main__":
    unittest.main()
