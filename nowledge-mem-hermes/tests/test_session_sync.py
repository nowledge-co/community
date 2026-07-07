from __future__ import annotations

import importlib.util
import sys
import types
from datetime import datetime, timezone
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
        self.skill_outcome_calls = []
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

    def report_skill_outcome(self, skill_id, version, *, outcome="completed"):
        self.skill_outcome_calls.append(
            {"skill_id": skill_id, "version": version, "outcome": outcome}
        )
        return True


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


def test_clean_session_messages_preserves_unix_timestamp_in_local_timezone():
    ts = 1762445171.0
    messages = provider.NowledgeMemProvider._clean_session_messages(
        [{"role": "user", "content": "hello", "started_at": ts}]
    )

    expected = (
        datetime.fromtimestamp(ts, tz=timezone.utc)
        .astimezone()
        .isoformat(timespec="seconds")
    )
    assert messages == [{"role": "user", "content": "hello", "timestamp": expected}]


def test_clean_session_messages_preserves_unix_millisecond_timestamp():
    ts = 1762445171000
    messages = provider.NowledgeMemProvider._clean_session_messages(
        [{"role": "assistant", "content": "world", "timestamp": ts}]
    )

    expected = (
        datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        .astimezone()
        .isoformat(timespec="seconds")
    )
    assert messages == [
        {"role": "assistant", "content": "world", "timestamp": expected}
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


def test_sync_turn_accepts_hermes_messages_payload_and_appends_transcript_delta():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-messages"
    instance._saved_message_count = 0

    first_messages = [
        {"role": "system", "content": "skip"},
        {"role": "user", "content": "question"},
        {"role": "assistant", "content": "answer"},
    ]
    instance.sync_turn(
        "question",
        "answer",
        session_id="session-messages",
        messages=first_messages,
    )

    second_messages = [
        *first_messages,
        {"role": "user", "content": "next"},
        {"role": "assistant", "content": "done"},
    ]
    instance.sync_turn(
        "next",
        "done",
        session_id="session-messages",
        messages=second_messages,
    )

    assert instance._client.import_calls == [
        {
            "thread_id": "session-messages",
            "messages": [
                {"role": "user", "content": "question"},
                {"role": "assistant", "content": "answer"},
            ],
            "title": "question",
            "source": "hermes",
        }
    ]
    assert instance._client.append_calls == [
        {
            "thread_id": "session-messages",
            "messages": [
                {"role": "user", "content": "next"},
                {"role": "assistant", "content": "done"},
            ],
        }
    ]


def test_sync_turn_reports_managed_skill_outcome_from_messages_once():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-skills"
    instance._saved_message_count = 0

    messages = [
        {
            "role": "assistant",
            "content": [
                {
                    "type": "tool_use",
                    "id": "call-1",
                    "name": "mcp__nowledge-mem__find_skills",
                    "input": {"query": "polish UI"},
                }
            ],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": "call-1",
                    "content": '{"skills":[{"id":"skill-hermes","version":2,"name":"Hermes"}]}',
                }
            ],
        },
        {"role": "user", "content": "question"},
        {"role": "assistant", "content": "answer"},
    ]

    instance.sync_turn(
        "question",
        "answer",
        session_id="session-skills",
        messages=messages,
    )
    instance.sync_turn(
        "next",
        "done",
        session_id="session-skills",
        messages=[*messages, {"role": "user", "content": "next"}, {"role": "assistant", "content": "done"}],
    )

    assert instance._client.skill_outcome_calls == [
        {"skill_id": "skill-hermes", "version": "2", "outcome": "completed"}
    ]


def test_sync_turn_reports_find_skills_match_without_version_as_v1():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-skills-v1"
    instance._saved_message_count = 0

    messages = [
        {
            "role": "assistant",
            "content": [
                {
                    "type": "tool_use",
                    "id": "call-v1",
                    "name": "mcp__nowledge-mem__find_skills",
                    "input": {"query": "Hermes Studio LPK"},
                }
            ],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": "call-v1",
                    "content": '{"matches":[{"id":"skill-hermes","name":"Hermes","title":"Hermes Skill","description":"A managed skill"}]}',
                }
            ],
        },
        {"role": "user", "content": "question"},
        {"role": "assistant", "content": "answer"},
    ]

    instance.sync_turn(
        "question",
        "answer",
        session_id="session-skills-v1",
        messages=messages,
    )

    assert instance._client.skill_outcome_calls == [
        {"skill_id": "skill-hermes", "version": "1", "outcome": "completed"}
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


def test_session_end_does_not_append_parent_prefix_when_only_delta_count_is_known():
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


def test_delta_only_sync_turn_with_messages_uses_current_turn_not_parent_history():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-old"
    instance._saved_message_count = 0

    instance.sync_turn("old question", "old answer", session_id="session-old")
    instance.on_session_switch("session-branch", parent_session_id="session-old", reset=False)
    instance.sync_turn(
        "branch question",
        "branch answer",
        session_id="session-branch",
        messages=[
            {"role": "user", "content": "old question"},
            {"role": "assistant", "content": "old answer"},
            {"role": "user", "content": "branch question"},
            {"role": "assistant", "content": "branch answer"},
        ],
    )

    assert instance._client.import_calls[-1] == {
        "thread_id": "session-branch",
        "messages": [
            {"role": "user", "content": "branch question"},
            {"role": "assistant", "content": "branch answer"},
        ],
        "title": "branch question",
        "source": "hermes",
    }


def test_session_end_catches_up_delta_only_session_tail_without_parent_prefix():
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
            {"role": "user", "content": "tail question"},
            {"role": "assistant", "content": "tail answer"},
        ]
    )

    assert instance._client.append_calls == [
        {
            "thread_id": "session-branch",
            "messages": [
                {"role": "user", "content": "tail question"},
                {"role": "assistant", "content": "tail answer"},
            ],
        }
    ]


def test_register_supports_provider_collector_and_hook_only_contexts():
    plugin = _load_plugin_module()

    provider_ctx = ProviderContext()
    plugin.register(provider_ctx)
    assert len(provider_ctx.providers) == 1
    assert provider_ctx.providers[0].name == "nowledge-mem"

    hook_ctx = HookOnlyContext()
    plugin.register(hook_ctx)
    assert "post_llm_call" in hook_ctx.hooks


def test_post_llm_call_fallback_forwards_conversation_history(monkeypatch):
    plugin = _load_plugin_module()
    calls = []

    class StubProvider:
        def sync_turn(self, user_content, assistant_content, *, session_id="", messages=None):
            calls.append(
                {
                    "user_content": user_content,
                    "assistant_content": assistant_content,
                    "session_id": session_id,
                    "messages": messages,
                }
            )

    monkeypatch.setattr(
        plugin,
        "_get_fallback_provider",
        lambda *, session_id, kwargs: StubProvider(),
    )

    conversation_history = [
        {"role": "system", "content": "skip"},
        {"role": "user", "content": "question"},
        {"role": "assistant", "content": "answer"},
    ]
    plugin._post_llm_call(
        session_id="session-hook",
        user_message="question",
        assistant_response="answer",
        conversation_history=conversation_history,
    )

    assert calls == [
        {
            "user_content": "question",
            "assistant_content": "answer",
            "session_id": "session-hook",
            "messages": conversation_history,
        }
    ]


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
