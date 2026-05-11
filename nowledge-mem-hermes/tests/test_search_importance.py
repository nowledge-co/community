from __future__ import annotations

import importlib.util
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


class SearchImportanceTests(unittest.TestCase):
    def test_schema_exposes_min_importance_filter(self):
        properties = provider._SEARCH["parameters"]["properties"]
        self.assertIn("min_importance", properties)
        self.assertEqual(properties["min_importance"]["type"], "number")

    def test_dispatch_passes_min_importance_to_client(self):
        captured: dict[str, object] = {}

        class _FakeClient:
            def search(self, query, **kwargs):
                captured["query"] = query
                captured.update(kwargs)
                return {"memories": []}

        instance = provider.NowledgeMemProvider()
        instance._client = _FakeClient()
        instance._dispatch(
            "nmem_search",
            {
                "query": "project context",
                "limit": 5,
                "filter_labels": "work,decision",
                "mode": "deep",
                "min_importance": 0.7,
            },
        )

        self.assertEqual(captured["query"], "project context")
        self.assertEqual(captured["limit"], 5)
        self.assertEqual(captured["filter_labels"], ["work", "decision"])
        self.assertEqual(captured["mode"], "deep")
        self.assertEqual(captured["min_importance"], 0.7)

    def test_client_search_adds_importance_flag(self):
        captured: dict[str, object] = {}
        original_run = client_module.subprocess.run

        def _fake_run(cmd, **kwargs):
            captured["cmd"] = cmd

            class _Result:
                returncode = 0
                stdout = "{}"
                stderr = ""

            return _Result()

        try:
            client_module.subprocess.run = _fake_run
            client = client_module.NowledgeMemClient()
            client.search("project context", min_importance=0.7)
        finally:
            client_module.subprocess.run = original_run

        self.assertEqual(
            captured["cmd"],
            ["nmem", "--json", "m", "search", "project context", "--importance", "0.7"],
        )

    def test_client_search_omits_importance_when_not_set(self):
        captured: dict[str, object] = {}
        original_run = client_module.subprocess.run

        def _fake_run(cmd, **kwargs):
            captured["cmd"] = cmd

            class _Result:
                returncode = 0
                stdout = "{}"
                stderr = ""

            return _Result()

        try:
            client_module.subprocess.run = _fake_run
            client = client_module.NowledgeMemClient()
            client.search("project context")
        finally:
            client_module.subprocess.run = original_run

        self.assertNotIn("--importance", captured["cmd"])


if __name__ == "__main__":
    unittest.main()
