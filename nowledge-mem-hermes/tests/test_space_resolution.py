from __future__ import annotations

import importlib.util
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

    def test_missing_identity_does_not_synthesize_space(self):
        resolved = provider.NowledgeMemProvider._resolve_space(
            {
                "space_by_identity": {"default": "Default Agent"},
                "space_template": "agent-{identity}",
            },
            {},
        )
        self.assertIsNone(resolved)


if __name__ == "__main__":
    unittest.main()
