from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path


def _load_provider_module():
    plugin_dir = Path(__file__).resolve().parents[1]

    _install_agent_stub()

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


def _load_plugin_module():
    plugin_dir = Path(__file__).resolve().parents[1]

    _install_agent_stub()

    package_name = "nowledge_mem_hermes_plugin_init"
    spec = importlib.util.spec_from_file_location(
        package_name,
        plugin_dir / "__init__.py",
        submodule_search_locations=[str(plugin_dir)],
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[package_name] = module
    spec.loader.exec_module(module)
    return module


def _install_agent_stub():
    agent_module = types.ModuleType("agent")
    memory_provider_module = types.ModuleType("agent.memory_provider")

    class MemoryProvider:  # pragma: no cover - compatibility stub
        pass

    memory_provider_module.MemoryProvider = MemoryProvider
    agent_module.memory_provider = memory_provider_module
    sys.modules.setdefault("agent", agent_module)
    sys.modules.setdefault("agent.memory_provider", memory_provider_module)


provider = _load_provider_module()


class FakeClient:
    def __init__(self):
        self.import_calls = []
        self.append_calls = []
        self.fail_import = False
        self.fail_append = False

    def import_thread(self, thread_id, messages, *, title=None, source="hermes"):
        if self.fail_import:
            raise RuntimeError("import failed")
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
        if self.fail_append:
            raise RuntimeError("append failed")
        self.append_calls.append({"thread_id": thread_id, "messages": messages})
        return {"success": True, "thread_id": thread_id}


class HookOnlyContext:
    def __init__(self):
        self.hooks = {}

    def register_hook(self, name, callback):
        self.hooks[name] = callback


class ProviderContext:
    def __init__(self):
        self.providers = []

    def register_memory_provider(self, provider_instance):
        self.providers.append(provider_instance)


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

    next_messages = [*first_messages, {"role": "user", "content": "next step"}]
    instance.on_session_end(next_messages)

    assert instance._client.append_calls == [
        {
            "thread_id": "session-1",
            "messages": [{"role": "user", "content": "next step"}],
        }
    ]


def test_sync_turn_imports_completed_one_shot_turn():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-oneshot"
    instance._saved_message_count = 0

    instance.sync_turn("question", "answer", session_id="session-oneshot")

    assert instance._client.import_calls == [
        {
            "thread_id": "session-oneshot",
            "messages": [
                {"role": "user", "content": "question"},
                {"role": "assistant", "content": "answer"},
            ],
            "title": "question",
            "source": "hermes",
        }
    ]


def test_initial_import_existing_thread_falls_back_to_dedup_append():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-existing"
    instance._saved_message_count = 0

    def _already_exists(thread_id, messages, *, title=None, source="hermes"):
        instance._client.import_calls.append(
            {
                "thread_id": thread_id,
                "messages": messages,
                "title": title,
                "source": source,
            }
        )
        return {
            "success": False,
            "results": [
                {
                    "success": False,
                    "error": "Thread session-existing already exists in space default",
                }
            ],
        }

    instance._client.import_thread = _already_exists

    instance.sync_turn("question", "answer", session_id="session-existing")

    assert instance._client.append_calls == [
        {
            "thread_id": "session-existing",
            "messages": [
                {"role": "user", "content": "question"},
                {"role": "assistant", "content": "answer"},
            ],
        }
    ]


def test_session_switch_resets_new_session_delta_before_sync_turn():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-old"
    instance._saved_message_count = 0

    instance.sync_turn("old question", "old answer", session_id="session-old")
    instance.on_session_switch(
        "session-new",
        parent_session_id="session-old",
        reset=True,
        reason="new_session",
    )
    instance.sync_turn("new question", "new answer", session_id="session-new")

    assert instance._client.import_calls == [
        {
            "thread_id": "session-old",
            "messages": [
                {"role": "user", "content": "old question"},
                {"role": "assistant", "content": "old answer"},
            ],
            "title": "old question",
            "source": "hermes",
        },
        {
            "thread_id": "session-new",
            "messages": [
                {"role": "user", "content": "new question"},
                {"role": "assistant", "content": "new answer"},
            ],
            "title": "new question",
            "source": "hermes",
        },
    ]
    assert instance._client.append_calls == []
    assert instance._session_id == "session-new"
    assert instance._saved_message_count == 2


def test_session_switch_preserves_per_session_delta_when_resuming():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-a"
    instance._saved_message_count = 0

    instance.sync_turn("a1", "a2", session_id="session-a")
    instance.on_session_switch("session-b", parent_session_id="session-a", reset=True)
    instance.sync_turn("b1", "b2", session_id="session-b")
    instance.on_session_switch("session-a", parent_session_id="session-b", reset=False)
    instance.sync_turn("a3", "a4", session_id="session-a")

    assert instance._client.import_calls[0]["thread_id"] == "session-a"
    assert instance._client.import_calls[1]["thread_id"] == "session-b"
    assert instance._client.append_calls == [
        {
            "thread_id": "session-a",
            "messages": [
                {"role": "user", "content": "a3"},
                {"role": "assistant", "content": "a4"},
            ],
        }
    ]
    assert instance._saved_message_counts["session-a"] == 4
    assert instance._saved_message_counts["session-b"] == 2


def test_session_switch_without_reset_does_not_reuse_previous_session_count():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-old"
    instance._saved_message_count = 0

    instance.sync_turn("old question", "old answer", session_id="session-old")
    instance.on_session_switch(
        "session-branch",
        parent_session_id="session-old",
        reset=False,
        reason="branch",
    )
    instance.sync_turn("branch question", "branch answer", session_id="session-branch")

    assert [call["thread_id"] for call in instance._client.import_calls] == [
        "session-old",
        "session-branch",
    ]
    assert instance._client.append_calls == []
    assert instance._saved_message_counts["session-branch"] == 2
    assert "session-branch" in instance._delta_only_sessions


def test_session_end_skips_full_flush_when_only_delta_count_is_known():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-old"
    instance._saved_message_count = 0

    instance.sync_turn("old question", "old answer", session_id="session-old")
    instance.on_session_switch("session-branch", parent_session_id="session-old", reset=False)
    instance.sync_turn("branch question", "branch answer", session_id="session-branch")

    instance.on_session_end(
        [
            {"role": "user", "content": "old question"},
            {"role": "assistant", "content": "old answer"},
            {"role": "user", "content": "branch question"},
            {"role": "assistant", "content": "branch answer"},
        ]
    )

    assert instance._client.append_calls == []


def test_register_supports_provider_collector_and_hook_only_contexts():
    plugin = _load_plugin_module()

    provider_ctx = ProviderContext()
    plugin.register(provider_ctx)
    assert len(provider_ctx.providers) == 1
    assert provider_ctx.providers[0].name == "nowledge-mem"

    hook_ctx = HookOnlyContext()
    plugin.register(hook_ctx)
    assert "post_llm_call" in hook_ctx.hooks


def test_on_session_end_skips_malformed_messages_and_failed_import_does_not_advance_count():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-2"
    instance._saved_message_count = 0
    instance._client.fail_import = True

    messages = [
        "bad",
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": {"content": "world"}},
    ]

    instance.on_session_end(messages)

    assert instance._saved_message_count == 0
    assert instance._client.import_calls == []


def test_on_session_end_failed_append_does_not_advance_count():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-3"
    instance._saved_message_count = 2
    instance._client.fail_append = True

    messages = [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "world"},
        {"role": "user", "content": "next step"},
    ]

    instance.on_session_end(messages)

    assert instance._saved_message_count == 2
    assert instance._client.append_calls == []
