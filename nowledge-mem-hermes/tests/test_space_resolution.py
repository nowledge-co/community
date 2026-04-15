from __future__ import annotations

import importlib.util
import json
import os
import sys
import types
import unittest
from pathlib import Path


def _load_provider_module():
    plugin_dir = Path(__file__).resolve().parents[1]

    agent_module = types.ModuleType("agent")
    memory_provider_module = types.ModuleType("agent.memory_provider")

    class MemoryProvider:  # pragma: no cover - compatibility stub
        pass

    memory_provider_module.MemoryProvider = MemoryProvider
    agent_module.memory_provider = memory_provider_module
    sys.modules.setdefault("agent", agent_module)
    sys.modules.setdefault("agent.memory_provider", memory_provider_module)

    package_name = "nowledge_mem_hermes"
    if package_name not in sys.modules:
        package = types.ModuleType(package_name)
        package.__path__ = [str(plugin_dir)]
        sys.modules[package_name] = package

    spec = importlib.util.spec_from_file_location(
        f"{package_name}.provider",
        plugin_dir / "provider.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


provider = _load_provider_module()
client_module = sys.modules["nowledge_mem_hermes.client"]


class SpaceResolutionTests(unittest.TestCase):
    def test_configured_space_beats_env(self):
        previous = os.environ.get("NMEM_SPACE")
        os.environ["NMEM_SPACE"] = "Env Space"
        try:
            resolved = provider.NowledgeMemProvider._resolve_space(
                {"space": "Configured Space"},
                {"agent_identity": "research"},
            )
            self.assertEqual(resolved, "Configured Space")
        finally:
            if previous is None:
                os.environ.pop("NMEM_SPACE", None)
            else:
                os.environ["NMEM_SPACE"] = previous

    def test_identity_map_beats_template(self):
        resolved = provider.NowledgeMemProvider._resolve_space(
            {
                "space_by_identity": {
                    "research": "Research Agent",
                    "ops": "Operations Agent",
                },
                "space_template": "agent-{identity}",
            },
            {"agent_identity": "research"},
        )
        self.assertEqual(resolved, "Research Agent")

    def test_template_falls_back_when_no_mapping(self):
        resolved = provider.NowledgeMemProvider._resolve_space(
            {"space_template": "agent-{identity}"},
            {"agent_identity": "ops"},
        )
        self.assertEqual(resolved, "agent-ops")

    def test_initialize_falls_back_on_invalid_timeout(self):
        captured: dict[str, object] = {}

        class _FakeClient:
            def __init__(self, timeout: int, space: str | None = None):
                captured["timeout"] = timeout
                captured["space"] = space

            def health(self):
                return True

            def working_memory(self):
                return {}

        original_client = provider.NowledgeMemClient
        try:
            provider.NowledgeMemClient = _FakeClient
            instance = provider.NowledgeMemProvider()
            instance._load_config = lambda _home: {"timeout": "abc", "space": "Research Agent"}
            instance.initialize("session-1", hermes_home="", platform="cli")
            self.assertEqual(captured["timeout"], 30)
            self.assertEqual(captured["space"], "Research Agent")
        finally:
            provider.NowledgeMemClient = original_client

    def test_explicit_empty_space_beats_environment(self):
        previous = os.environ.get("NMEM_SPACE")
        os.environ["NMEM_SPACE"] = "Env Space"
        try:
            resolved = provider.NowledgeMemProvider._resolve_space(
                {"space": ""},
                {},
            )
            self.assertEqual(resolved, "")
        finally:
            if previous is None:
                os.environ.pop("NMEM_SPACE", None)
            else:
                os.environ["NMEM_SPACE"] = previous

    def test_non_string_space_falls_through_to_identity_resolution(self):
        resolved = provider.NowledgeMemProvider._resolve_space(
            {
                "space": None,
                "space_by_identity": {"research": "Research Agent"},
            },
            {"agent_identity": "research"},
        )
        self.assertEqual(resolved, "Research Agent")

    def test_missing_identity_does_not_synthesize_space(self):
        previous_space = os.environ.get("NMEM_SPACE")
        previous_space_id = os.environ.get("NMEM_SPACE_ID")
        os.environ.pop("NMEM_SPACE", None)
        os.environ.pop("NMEM_SPACE_ID", None)
        try:
            resolved = provider.NowledgeMemProvider._resolve_space(
                {
                    "space_by_identity": {"default": "Default Agent"},
                    "space_template": "agent-{identity}",
                },
                {},
            )
            self.assertIsNone(resolved)
        finally:
            if previous_space is None:
                os.environ.pop("NMEM_SPACE", None)
            else:
                os.environ["NMEM_SPACE"] = previous_space
            if previous_space_id is None:
                os.environ.pop("NMEM_SPACE_ID", None)
            else:
                os.environ["NMEM_SPACE_ID"] = previous_space_id

    def test_client_explicit_empty_space_clears_inherited_environment(self):
        captured: dict[str, object] = {}
        original_run = client_module.subprocess.run
        previous_space = os.environ.get("NMEM_SPACE")
        previous_space_id = os.environ.get("NMEM_SPACE_ID")
        os.environ["NMEM_SPACE"] = "Env Space"
        os.environ["NMEM_SPACE_ID"] = "Env Space"

        def _fake_run(cmd, **kwargs):
            captured["env"] = kwargs.get("env", {})

            class _Result:
                returncode = 0
                stdout = "{}"
                stderr = ""

            return _Result()

        try:
            client_module.subprocess.run = _fake_run
            client = client_module.NowledgeMemClient(space="")
            client.working_memory()
            env = captured["env"]
            self.assertNotIn("NMEM_SPACE", env)
            self.assertNotIn("NMEM_SPACE_ID", env)
        finally:
            client_module.subprocess.run = original_run
            if previous_space is None:
                os.environ.pop("NMEM_SPACE", None)
            else:
                os.environ["NMEM_SPACE"] = previous_space
            if previous_space_id is None:
                os.environ.pop("NMEM_SPACE_ID", None)
            else:
                os.environ["NMEM_SPACE_ID"] = previous_space_id

    def test_client_explicit_space_sets_subprocess_environment(self):
        captured: dict[str, object] = {}
        original_run = client_module.subprocess.run
        previous_space = os.environ.get("NMEM_SPACE")
        previous_space_id = os.environ.get("NMEM_SPACE_ID")
        os.environ["NMEM_SPACE"] = "Env Space"
        os.environ["NMEM_SPACE_ID"] = "Env Space"

        def _fake_run(cmd, **kwargs):
            captured["env"] = kwargs.get("env", {})

            class _Result:
                returncode = 0
                stdout = "{}"
                stderr = ""

            return _Result()

        try:
            client_module.subprocess.run = _fake_run
            client = client_module.NowledgeMemClient(space="Research Agent")
            client.working_memory()
            env = captured["env"]
            self.assertEqual(env.get("NMEM_SPACE"), "Research Agent")
            self.assertEqual(env.get("NMEM_SPACE_ID"), "Research Agent")
        finally:
            client_module.subprocess.run = original_run
            if previous_space is None:
                os.environ.pop("NMEM_SPACE", None)
            else:
                os.environ["NMEM_SPACE"] = previous_space
            if previous_space_id is None:
                os.environ.pop("NMEM_SPACE_ID", None)
            else:
                os.environ["NMEM_SPACE_ID"] = previous_space_id

    def test_thread_import_posts_payload_without_subprocess_argv(self):
        captured: dict[str, object] = {}
        original_run = client_module.subprocess.run
        original_urlopen = client_module.urlrequest.urlopen
        previous_url = os.environ.get("NMEM_API_URL")
        previous_key = os.environ.get("NMEM_API_KEY")
        os.environ["NMEM_API_URL"] = "http://mem.test"
        os.environ["NMEM_API_KEY"] = ""

        def _bad_run(*_args, **_kwargs):
            raise AssertionError("thread import must not send transcript through argv")

        class _Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b'{"success": true}'

        def _fake_urlopen(request, **_kwargs):
            captured["url"] = request.full_url
            captured["body"] = request.data.decode("utf-8")
            return _Response()

        try:
            client_module.subprocess.run = _bad_run
            client_module.urlrequest.urlopen = _fake_urlopen
            client = client_module.NowledgeMemClient(space="Research Agent")
            result = client.import_thread(
                "hermes-session-1",
                [{"role": "user", "content": "x" * 100_000}],
                title="Long session",
            )
            payload = json.loads(captured["body"])
            self.assertEqual(result["success"], True)
            self.assertEqual(captured["url"], "http://mem.test/threads/import")
            self.assertEqual(payload["thread_id"], "hermes-session-1")
            self.assertEqual(payload["metadata"]["space_id"], "Research Agent")
            self.assertEqual(payload["messages"][0]["content"], "x" * 100_000)
        finally:
            client_module.subprocess.run = original_run
            client_module.urlrequest.urlopen = original_urlopen
            if previous_url is None:
                os.environ.pop("NMEM_API_URL", None)
            else:
                os.environ["NMEM_API_URL"] = previous_url
            if previous_key is None:
                os.environ.pop("NMEM_API_KEY", None)
            else:
                os.environ["NMEM_API_KEY"] = previous_key

    def test_thread_append_posts_payload_without_subprocess_argv(self):
        captured: dict[str, object] = {}
        original_run = client_module.subprocess.run
        original_urlopen = client_module.urlrequest.urlopen
        previous_url = os.environ.get("NMEM_API_URL")
        previous_key = os.environ.get("NMEM_API_KEY")
        os.environ["NMEM_API_URL"] = "http://mem.test"
        os.environ["NMEM_API_KEY"] = ""

        def _bad_run(*_args, **_kwargs):
            raise AssertionError("thread append must not send transcript through argv")

        class _Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b'{"success": true, "messages_added": 1}'

        def _fake_urlopen(request, **_kwargs):
            captured["url"] = request.full_url
            captured["body"] = request.data.decode("utf-8")
            return _Response()

        try:
            client_module.subprocess.run = _bad_run
            client_module.urlrequest.urlopen = _fake_urlopen
            client = client_module.NowledgeMemClient()
            result = client.append_thread(
                "hermes/session 1",
                [{"role": "assistant", "content": "y" * 100_000}],
            )
            payload = json.loads(captured["body"])
            self.assertEqual(result["messages_added"], 1)
            self.assertEqual(
                captured["url"],
                "http://mem.test/threads/hermes%2Fsession%201/append",
            )
            self.assertEqual(payload["messages"][0]["content"], "y" * 100_000)
        finally:
            client_module.subprocess.run = original_run
            client_module.urlrequest.urlopen = original_urlopen
            if previous_url is None:
                os.environ.pop("NMEM_API_URL", None)
            else:
                os.environ["NMEM_API_URL"] = previous_url
            if previous_key is None:
                os.environ.pop("NMEM_API_KEY", None)
            else:
                os.environ["NMEM_API_KEY"] = previous_key


if __name__ == "__main__":
    unittest.main()
