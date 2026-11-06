"""Cross-host startup memory and optional session registration contracts."""
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]


class StartupMailboxTests(unittest.TestCase):
    def test_native_bridge_skill_survives_standalone_codex_and_claude_packaging(self):
        registry = json.loads((ROOT / "integrations.json").read_text(encoding="utf-8"))
        for identity, directory, manifest_path in [
            ("codex-cli", "nowledge-mem-codex-plugin", ".codex-plugin/plugin.json"),
            ("claude-code", "nowledge-mem-claude-code-plugin", ".claude-plugin/plugin.json"),
        ]:
            with self.subTest(host=identity), tempfile.TemporaryDirectory() as temporary:
                installed = Path(temporary) / "package"
                shutil.copytree(ROOT / directory, installed, symlinks=True)
                manifest = json.loads((installed / manifest_path).read_text(encoding="utf-8"))
                integration = next(item for item in registry["integrations"] if item["id"] == identity)
                self.assertEqual(integration["version"], manifest["version"])
                self.assertIn("bridge", integration["skills"])
                skill = installed / manifest.get("skills", "skills") / "bridge/SKILL.md"
                self.assertTrue(skill.is_file(), "the installed host needs the advertised skill")
                self.assertFalse(skill.is_symlink())
                references = re.findall(r"\[[^\]]+\]\((references/[^)]+)\)", skill.read_text(encoding="utf-8"))
                self.assertTrue(references)
                for target in references:
                    reference = skill.parent / target
                    self.assertTrue(reference.is_file())
                    self.assertFalse(reference.is_symlink())
                    reference.resolve().relative_to(installed.resolve())
                    content = reference.read_text(encoding="utf-8")
                    self.assertNotIn("/Users/", content)
                    self.assertNotIn("nowledge-co/mem/", content)

    def test_cloud_session_guidance_preserves_host_arguments_without_startup_effects(self):
        for host in ("codex", "claude-code"):
            for source in ("startup", "resume", "compact"):
                with self.subTest(host=host, source=source):
                    context, calls = self.invoke(host, source=source, original_kind="cloud-session")
                    self.assertIn("independent working memory", context)
                    section = context.split("## Nowledge Bridge original session\n\n", 1)[1]
                    observation = json.loads(section.split("\n\n", 1)[0])
                    self.assertEqual(observation["host"], host)
                    self.assertEqual(observation["native_session_id"], "exact-native")
                    self.assertEqual(observation["session_args"], [
                        "--agent-context=reviewer", "bridge", "session", f"--host={host}",
                        "--session-id=exact-native",
                    ])
                    self.assertNotIn("delivery_ready", observation)
                    self.assertFalse(any("session-bootstrap" in args or "prepare" in args
                                         or "claim" in args or "send" in args for args in calls))

    def invoke(
        self, host, *, named=True, failure="disabled", source="startup",
        conflict=False, native=True, mutate=None, switch=False, identity=None,
        explicit_space=None, event="SessionStart", pending_reference=None,
        original_kind=None, pending=True, memory_available=True, cli_available=True,
        selection_available=True, agent_type="researcher",
    ):
        folder = ROOT / ("nowledge-mem-codex-plugin/hooks" if host == "codex" else "nowledge-mem-claude-code-plugin/scripts")
        script = folder / ("nmem-context.py" if host == "codex" else "nmem-hook-context.py")
        selection = {"scope": {"store_id": "store", "store_incarnation": "incarnation", "workspace_id": None, "space_id": "team-space"},
                     "address": {"agent_id": "reviewer", "identity_birth": "birth", "custodian_id": "owner", "attachment_id": "attachment", "attachment_generation": 1}}
        if mutate:
            mutate(selection)
        calls = []
        shows = 0
        def run(argv, **kwargs):
            nonlocal shows
            args = argv[2:]
            calls.append(args)
            if args[:3] == ["agents", "context", "show"]:
                if not selection_available:
                    return subprocess.CompletedProcess(argv, 1, '{}', "")
                shows += 1
                current = json.loads(json.dumps(selection))
                if switch and shows > 1:
                    current["scope"]["space_id"] = "other-space"
                reply = {"name": "reviewer", "configured": True, "selection": current}
            elif "session-bootstrap" in args:
                if failure == "timeout":
                    raise subprocess.TimeoutExpired(argv, kwargs["timeout"])
                if failure != "ready":
                    return subprocess.CompletedProcess(argv, 1, json.dumps({"http_status": 503, "error_code": "mailbox_delivery_unavailable", "detail": "private-secret"}), "private-secret")
                reply = {"state": "active", "context": "reviewer", "resumed": source == "resume", "delivery_ready": True,
                         "receiving_capability": {"protocol_version": 2, "receive_mode": "auto", "recovery_owner": "server"},
                         "registration": {"address": {"schema_version": 2, "scope": selection["scope"], "agent": selection["address"], "session_id": "opaque", "registration_id": "registration", "mailbox_id": "mailbox", "binding_generation": 1},
                                          "state": "active", "registered_at": 10, "observed_at": 11, "lease_expires_at": 20, "closed_at": None}}
            elif "probe" in args:
                if original_kind == "unavailable":
                    return subprocess.CompletedProcess(argv, 1, '{}', "")
                reply = {"schema_version": 1, "host": host, "session_id": "exact-native", "context": "reviewer", "mailbox_kind": original_kind or ("cloud-session" if source in {"resume", "compact"} else "local-session")}
            elif args[:2] == ["agents", "show"]:
                return subprocess.CompletedProcess(argv, 1, '{}', "")
            elif "mailbox" in args:
                return subprocess.CompletedProcess(argv, 1, '{"error_code":"mailbox_delivery_unavailable"}', "")
            elif args[:2] == ["wm", "read"]:
                if not memory_available:
                    return subprocess.CompletedProcess(argv, 1, '{}', "")
                reply = {"exists": True, "content": "independent working memory"}
            else:
                return subprocess.CompletedProcess(argv, 1, '{}', "")
            return subprocess.CompletedProcess(argv, 0, json.dumps(reply), "")
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            (Path(directory) / "memory.md").write_text("legacy Default briefing", encoding="utf-8")
            env = {"CODEX_HOME": directory, "NMEM_BRIDGE_SESSION_MAILBOX": "1" if native else "0", "NMEM_AI_NOW_HOME": directory}
            if named:
                env["NMEM_AGENT_CONTEXT"] = "reviewer"
            if identity:
                env["NMEM_AGENT_ID"] = identity
            if explicit_space:
                env["NMEM_SPACE"] = explicit_space
            if conflict:
                env["NMEM_SPACE"] = "different-space"
            stack.enter_context(mock.patch.dict(os.environ, env, clear=True))
            stack.enter_context(mock.patch.object(sys, "path", [str(folder), *sys.path]))
            spec = importlib.util.spec_from_file_location("startup_" + host, script)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            stack.enter_context(mock.patch.object(module.subprocess, "run", side_effect=run))
            stack.enter_context(mock.patch.object(module, "_nmem_command" if host == "codex" else "find_nmem", return_value="/pinned/nmem" if cli_available else None))
            payload = {"hook_event_name": event, "source": source, "session_id": "exact-native", "agent_type": agent_type}
            stack.enter_context(mock.patch.object(sys, "stdin", io.StringIO(json.dumps(payload))))
            output = stack.enter_context(mock.patch.object(sys, "stdout", io.StringIO()))
            if host == "codex":
                stack.enter_context(mock.patch.object(module, "_resume_context", return_value=("", False)))
                if event == "SubagentStart":
                    stack.enter_context(mock.patch.object(module, "_pending_startup", return_value=(pending, "")))
                    stack.enter_context(mock.patch.object(module, "_read_pending", return_value=("present", {"context_reference": pending_reference, "context_name": "reviewer", "space_id": "team-space"})))
                self.assertEqual(module.main(payload), 0)
            else:
                self.assertEqual(module.main(), 0)
            response = json.loads(output.getvalue())["hookSpecificOutput"]["additionalContext"]
        return response, calls

    def test_mailbox_failure_keeps_exact_space_working_memory(self):
        for host in ("codex", "claude-code"):
            for failure in ("disabled", "timeout", "refused"):
                for source in ("startup", "resume", "compact"):
                    with self.subTest(host=host, failure=failure, source=source):
                        context, calls = self.invoke(host, failure=failure, source=source)
                        self.assertIn("independent working memory", context)
                        self.assertIn(["wm", "read", "--space-id", "team-space"], calls)
                        self.assertFalse(any(args[0] == "context" for args in calls))
                        self.assertNotIn("private-secret", context)
                        self.assertNotIn("Backend session messaging is ready", context)
                        memory_index = calls.index(["wm", "read", "--space-id", "team-space"])
                        self.assertTrue(all(i > memory_index for i, args in enumerate(calls) if "session-bootstrap" in args))

    def test_legacy_mailbox_failure_still_injects_memory(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host):
                context, calls = self.invoke(host, native=False)
                self.assertIn("independent working memory", context)
                self.assertIn(["wm", "read", "--space-id", "team-space"], calls)
                self.assertFalse(any(args[0] == "context" or "session-bootstrap" in args for args in calls))

    def test_malformed_selection_never_falls_back_or_registers(self):
        mutations = [("scope", "store_id", None), ("scope", "space_id", "bad\0id"),
                     ("scope", "space_id", "\ud800"), ("scope", "space_id", {}),
                     ("address", "identity_birth", None),
                     *[("address", "attachment_generation", value) for value in (True, 0, -1, 1.5, 1 << 53)]]
        for host in ("codex", "claude-code"):
            for part, key, value in mutations:
                with self.subTest(host=host, part=part, key=key, value=repr(value)):
                    def mutate(selection):
                        if value is None:
                            del selection[part][key]
                        else:
                            selection[part][key] = value
                    context, calls = self.invoke(host, mutate=mutate)
                    self.assertNotIn("independent working memory", context)
                    self.assertNotIn("Backend session messaging is ready", context)
                    self.assertFalse(any(args[:2] == ["wm", "read"] or "session-bootstrap" in args or args[0] == "context" for args in calls))

    def test_context_switch_after_memory_cannot_register_another_lane(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host):
                context, calls = self.invoke(host, failure="ready", switch=True)
                self.assertIn("independent working memory", context)
                self.assertNotIn("Backend session messaging is ready", context)
                self.assertIn("selection_changed", context)
                self.assertFalse(any("session-bootstrap" in args for args in calls))

    def test_resume_preserves_existing_cloud_transport_without_bootstrap(self):
        for host in ("codex", "claude-code"):
            for source in ("startup", "clear", "resume", "compact"):
                with self.subTest(host=host, source=source):
                    context, calls = self.invoke(host, source=source, original_kind="cloud-session")
                    self.assertIn("independent working memory", context)
                    self.assertIn("original_session_preserved", context)
                    self.assertFalse(any("session-bootstrap" in args or "cloud-session-bootstrap" in args for args in calls))
                    self.assertIn(["--agent-context", "reviewer", "mailbox", "probe", "--host", host, "--session-id", "exact-native", "--native-session"], calls)

    def test_explicit_identity_without_mailbox_never_ensures_a_profile(self):
        for host in ("codex", "claude-code"):
            for space in (None, "team-space"):
                with self.subTest(host=host, space=space):
                    context, calls = self.invoke(host, named=False, native=False, identity="not-created", explicit_space=space)
                    self.assertFalse(any(args[0] == "context" or "enroll" in args or "session-bootstrap" in args for args in calls))
                    if space:
                        self.assertIn("independent working memory", context)
                        self.assertEqual(calls, [["wm", "read", "--space", space]])
                    else:
                        self.assertNotIn("independent working memory", context)
                        self.assertEqual(calls, [["agents", "show", "not-created"]])

    def test_selected_pending_subagent_memory_does_not_require_a_mailbox(self):
        context, calls = self.invoke("codex", native=False, event="SubagentStart")
        self.assertIn("independent working memory", context)
        self.assertIn(["wm", "read", "--space-id", "team-space"], calls)
        self.assertFalse(any("mailbox" in args for args in calls))
        context, calls = self.invoke("codex", native=False, event="SubagentStart", pending_reference={"original": "pending"})
        self.assertNotIn("independent working memory", context)
        self.assertFalse(any(args[:2] == ["wm", "read"] for args in calls))

    def test_named_subagent_without_pending_uses_only_exact_space_memory(self):
        for role in ("planner", "researcher"):
            for native in (False, True):
                with self.subTest(role=role, native=native):
                    context, calls = self.invoke(
                        "codex", event="SubagentStart", pending=False,
                        native=native, agent_type=role,
                    )
                    self.assertIn("independent working memory", context)
                    self.assertNotIn("legacy Default briefing", context)
                    self.assertEqual(calls, [
                        ["agents", "context", "show", "--name", "reviewer"],
                        ["wm", "read", "--space-id", "team-space"],
                    ])

    def test_named_subagent_without_pending_never_falls_back_on_failure(self):
        cases = [
            {"conflict": True},
            {"mutate": lambda selection: selection["scope"].pop("store_id")},
            {"selection_available": False},
            {"memory_available": False},
            {"cli_available": False},
        ]
        for case in cases:
            with self.subTest(case=case):
                context, calls = self.invoke(
                    "codex", event="SubagentStart", pending=False, native=False, **case,
                )
                self.assertNotIn("independent working memory", context)
                self.assertNotIn("legacy Default briefing", context)
                expected = [] if case.get("cli_available") is False else [
                    ["agents", "context", "show", "--name", "reviewer"],
                ]
                if case.get("memory_available") is False:
                    expected.append(["wm", "read", "--space-id", "team-space"])
                self.assertEqual(calls, expected)

    def test_unknown_original_never_authorizes_first_registration(self):
        for host in ("codex", "claude-code"):
            for source in ("startup", "clear", "resume", "compact"):
                with self.subTest(host=host, source=source):
                    context, calls = self.invoke(host, source=source, original_kind="unavailable")
                    self.assertIn("independent working memory", context)
                    self.assertIn("original_session_unverified", context)
                    self.assertFalse(any("session-bootstrap" in args for args in calls))

    def test_identity_resolution_and_memory_share_the_loader_deadline(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host), ExitStack() as stack:
                folder = ROOT / ("nowledge-mem-codex-plugin/hooks" if host == "codex" else "nowledge-mem-claude-code-plugin/scripts")
                script = folder / ("nmem-context.py" if host == "codex" else "nmem-hook-context.py")
                stack.enter_context(mock.patch.dict(os.environ, {"NMEM_AGENT_ID": "reviewer"}, clear=True))
                stack.enter_context(mock.patch.object(sys, "path", [str(folder), *sys.path]))
                spec = importlib.util.spec_from_file_location("deadline_" + host, script)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                stack.enter_context(mock.patch.object(module, "_nmem_command" if host == "codex" else "find_nmem", return_value="/pinned/nmem"))
                clock = [0.0]
                timeouts = []
                def run(argv, **kwargs):
                    timeouts.append(kwargs["timeout"])
                    if argv[2:4] == ["agents", "show"]:
                        clock[0] += 3.0
                        reply = {"id": "reviewer", "defaultSpaceId": "team-space"}
                    else:
                        self.assertEqual(argv[2:], ["wm", "read", "--space-id", "team-space"])
                        reply = {"content": "bounded memory"}
                    return subprocess.CompletedProcess(argv, 0, json.dumps(reply), "")
                stack.enter_context(mock.patch.object(module.time, "monotonic", side_effect=lambda: clock[0]))
                stack.enter_context(mock.patch.object(module.subprocess, "run", side_effect=run))
                if host == "codex":
                    self.assertEqual(module._load_startup_context(total_timeout_seconds=4, attempt_timeout_seconds=3), "bounded memory")
                else:
                    self.assertEqual(module.load_context(4).content, "bounded memory")
                self.assertEqual(timeouts, [3.0, 1.0])

    def test_no_identity_still_reads_working_memory_without_enrollment(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host):
                context, calls = self.invoke(host, named=False)
                self.assertIn("independent working memory", context)
                self.assertEqual(calls, [["wm", "read"]])
                self.assertIn("selection_required", context)

    def test_ambient_conflict_never_reads_another_space(self):
        for host in ("codex", "claude-code"):
            with self.subTest(host=host):
                context, calls = self.invoke(host, conflict=True)
                self.assertNotIn("independent working memory", context)
                self.assertFalse(any(args[:2] == ["wm", "read"] for args in calls))
                self.assertFalse(any("session-bootstrap" in args for args in calls))

    def test_qualified_session_keeps_exact_host_and_original_resume_id(self):
        for host in ("codex", "claude-code"):
            for source in ("startup",):
                with self.subTest(host=host, source=source):
                    context, calls = self.invoke(host, source=source, failure="ready")
                    self.assertIn("independent working memory", context)
                    self.assertIn("Backend session messaging is ready", context)
                    self.assertIn(["--agent-context", "reviewer", "mailbox", "session-bootstrap", "--host", host, "--session-id", "exact-native"], calls)
                    self.assertIn('"native_session_id": "exact-native"', context)
                    self.assertNotIn("--host " + ("codex" if host == "claude-code" else "claude-code"), context)


@unittest.skipUnless(shutil.which("sh"), "sh is required for shell fallback contracts")
class NamedContextShellFallbackTests(unittest.TestCase):
    def invoke(self, entrypoint, named):
        plugin = ROOT / "nowledge-mem-claude-code-plugin"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bin_dir = root / "bin"
            bin_dir.mkdir()
            # Shell builtins keep this fixture independent of Python and native DLLs.
            cat = bin_dir / "cat"
            cat.write_text(
                '#!/bin/sh\nwhile IFS= read -r line; do printf \'%s\\n\' "$line"; done < "$1"\n',
                encoding="utf-8",
            )
            cat.chmod(0o755)
            (root / "memory.md").write_text("legacy Default briefing\n", encoding="utf-8")
            env = {
                key: value for key, value in os.environ.items()
                if not key.startswith(("NMEM_", "GROK_", "CLAUDE_"))
            }
            env.update(
                PATH=bin_dir.as_posix(), HOME=root.as_posix(),
                NMEM_AI_NOW_HOME=root.as_posix(),
                CLAUDE_PLUGIN_ROOT=(root / "missing-plugin").as_posix(),
            )
            if named:
                env["NMEM_AGENT_CONTEXT"] = "reviewer"
            shell = shutil.which("sh")
            if entrypoint == "raw":
                command = [shell, str(plugin / "scripts/nmem-hook-read.sh")]
            else:
                hooks = json.loads((plugin / "hooks/hooks.json").read_text(encoding="utf-8"))
                index = 0 if entrypoint == "missing-startup" else 1
                hook = hooks["hooks"]["SessionStart"][index]["hooks"][0]
                command = [shell, "-c", hook["command"]]
            result = subprocess.run(
                command, env=env, capture_output=True, text=True,
                encoding="utf-8", timeout=5, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return result.stdout

    def test_named_context_blocks_shell_only_default_file_reads(self):
        for entrypoint in ("raw", "missing-startup", "missing-compact"):
            with self.subTest(entrypoint=entrypoint):
                self.assertNotIn("legacy Default briefing", self.invoke(entrypoint, named=True))

    def test_unconfigured_default_keeps_shell_file_compatibility(self):
        for entrypoint in ("raw", "missing-startup", "missing-compact"):
            with self.subTest(entrypoint=entrypoint):
                self.assertIn("legacy Default briefing", self.invoke(entrypoint, named=False))


if __name__ == "__main__":
    unittest.main()
