from __future__ import annotations

import importlib.util
import sys
import types
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

    package_name = "nowledge_mem_hermes_session_sync"
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


class FakeClient:
    def __init__(self):
        self.import_calls = []
        self.append_calls = []

    def import_thread(self, thread_id, messages, *, title=None, source="hermes"):
        self.import_calls.append(
            {
                "thread_id": thread_id,
                "messages": messages,
                "title": title,
                "source": source,
            }
        )
        return {"success": True, "thread_id": thread_id}

    def append_thread(self, thread_id, messages):
        self.append_calls.append({"thread_id": thread_id, "messages": messages})
        return {"success": True, "thread_id": thread_id}


def test_on_session_end_imports_clean_messages_then_appends_delta():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-1"
    instance._saved_message_count = 0

    first_messages = [
        {"role": "system", "content": "skip"},
        {"role": "user", "content": [{"type": "text", "text": " hello "}]},
        {"role": "assistant", "content": "hi there"},
        {"role": "tool", "content": "skip"},
        {"role": "assistant", "content": {"text": " more detail "}},
    ]

    instance.on_session_end(first_messages)

    assert instance._client.import_calls == [
        {
            "thread_id": "session-1",
            "messages": [
                {"role": "user", "content": "hello"},
                {"role": "assistant", "content": "hi there"},
                {"role": "assistant", "content": "more detail"},
            ],
            "title": "hello",
            "source": "hermes",
        }
    ]
    assert instance._client.append_calls == []

    next_messages = first_messages + [{"role": "user", "content": "next step"}]
    instance.on_session_end(next_messages)

    assert instance._client.append_calls == [
        {
            "thread_id": "session-1",
            "messages": [{"role": "user", "content": "next step"}],
        }
    ]
