from __future__ import annotations

import importlib.util
import sys
import types
from datetime import datetime, timezone
from pathlib import Path

import pytest


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
        self.semantic_import_failure = False
        self.semantic_append_failure = False
        self.fail_append_after_recording = False

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
        if self.semantic_import_failure:
            return {
                "success": False,
                "results": [{"success": False, "error": "import rejected"}],
            }
        return {"success": True, "thread_id": thread_id}

    def append_thread(self, thread_id, messages):
        if self.fail_append:
            raise RuntimeError("append failed")
        self.append_calls.append({"thread_id": thread_id, "messages": messages})
        if self.fail_append_after_recording:
            raise RuntimeError("append acknowledgement lost")
        if self.semantic_append_failure:
            return {
                "success": False,
                "results": [{"success": False, "error": "append rejected"}],
            }
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


def test_sync_turn_ignores_find_skills_match_with_non_skill_style_id():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-skills-non-skill-id"
    instance._saved_message_count = 0

    messages = [
        {
            "role": "assistant",
            "content": [
                {
                    "type": "tool_use",
                    "id": "call-non-skill-id",
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
                    "tool_use_id": "call-non-skill-id",
                    "content": '{"matches":[{"skill_id":"hermes","version":2,"name":"Hermes"}]}',
                }
            ],
        },
        {"role": "user", "content": "question"},
        {"role": "assistant", "content": "answer"},
    ]

    instance.sync_turn(
        "question",
        "answer",
        session_id="session-skills-non-skill-id",
        messages=messages,
    )

    assert instance._client.skill_outcome_calls == []


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


def test_failed_delta_only_import_retries_missing_turn_before_later_turn():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-old"
    instance._saved_message_count = 0

    instance.sync_turn("old question", "old answer", session_id="session-old")
    instance.on_session_switch("session-branch", parent_session_id="session-old", reset=False)

    instance._client.fail_import = True
    instance.sync_turn(
        "first branch question",
        "first branch answer",
        session_id="session-branch",
        messages=[
            {"role": "user", "content": "old question"},
            {"role": "assistant", "content": "old answer"},
            {"role": "user", "content": "first branch question"},
            {"role": "assistant", "content": "first branch answer"},
        ],
    )
    instance._client.fail_import = False

    instance.sync_turn(
        "second branch question",
        "second branch answer",
        session_id="session-branch",
        messages=[
            {"role": "user", "content": "old question"},
            {"role": "assistant", "content": "old answer"},
            {"role": "user", "content": "first branch question"},
            {"role": "assistant", "content": "first branch answer"},
            {"role": "user", "content": "second branch question"},
            {"role": "assistant", "content": "second branch answer"},
        ],
    )

    assert instance._client.import_calls[-1] == {
        "thread_id": "session-branch",
        "messages": [
            {"role": "user", "content": "first branch question"},
            {"role": "assistant", "content": "first branch answer"},
            {"role": "user", "content": "second branch question"},
            {"role": "assistant", "content": "second branch answer"},
        ],
        "title": "first branch question",
        "source": "hermes",
    }
    assert instance._saved_message_counts["session-branch"] == 4


def test_session_end_recovers_pending_delta_only_import_without_parent_prefix():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-old"
    instance._saved_message_count = 0

    instance.sync_turn("old question", "old answer", session_id="session-old")
    instance.on_session_switch("session-branch", parent_session_id="session-old", reset=False)

    instance._client.fail_import = True
    instance.sync_turn("branch question", "branch answer", session_id="session-branch")
    instance._client.fail_import = False

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

    assert instance._client.import_calls[-1] == {
        "thread_id": "session-branch",
        "messages": [
            {"role": "user", "content": "branch question"},
            {"role": "assistant", "content": "branch answer"},
            {"role": "user", "content": "tail question"},
            {"role": "assistant", "content": "tail answer"},
        ],
        "title": "branch question",
        "source": "hermes",
    }


def test_failed_append_retries_pending_turn_before_next_turn():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-append"
    instance._saved_message_count = 0

    instance.sync_turn("first question", "first answer", session_id="session-append")
    instance._client.fail_append = True
    instance.sync_turn("second question", "second answer", session_id="session-append")
    instance._client.fail_append = False

    instance.sync_turn("third question", "third answer", session_id="session-append")

    assert instance._client.append_calls == [
        {
            "thread_id": "session-append",
            "messages": [
                {"role": "user", "content": "second question"},
                {"role": "assistant", "content": "second answer"},
                {"role": "user", "content": "third question"},
                {"role": "assistant", "content": "third answer"},
            ],
        }
    ]
    assert instance._saved_message_counts["session-append"] == 6


def test_semantic_import_failure_retains_pending_delta_until_success():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-semantic"
    instance._saved_message_count = 0
    instance._client.semantic_import_failure = True

    instance.sync_turn("first question", "first answer", session_id="session-semantic")
    instance.sync_turn("second question", "second answer", session_id="session-semantic")

    assert instance._saved_message_counts["session-semantic"] == 0

    instance._client.semantic_import_failure = False
    instance.sync_turn("third question", "third answer", session_id="session-semantic")

    assert instance._client.import_calls[-1] == {
        "thread_id": "session-semantic",
        "messages": [
            {"role": "user", "content": "first question"},
            {"role": "assistant", "content": "first answer"},
            {"role": "user", "content": "second question"},
            {"role": "assistant", "content": "second answer"},
            {"role": "user", "content": "third question"},
            {"role": "assistant", "content": "third answer"},
        ],
        "title": "first question",
        "source": "hermes",
    }


def test_semantic_append_failure_retains_pending_delta_until_success():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-semantic-append"
    instance._saved_message_count = 0

    instance.sync_turn("first question", "first answer", session_id="session-semantic-append")
    instance._client.semantic_append_failure = True
    instance.sync_turn("second question", "second answer", session_id="session-semantic-append")

    assert instance._saved_message_counts["session-semantic-append"] == 2

    instance._client.semantic_append_failure = False
    instance.sync_turn("third question", "third answer", session_id="session-semantic-append")

    assert instance._client.append_calls[-1] == {
        "thread_id": "session-semantic-append",
        "messages": [
            {"role": "user", "content": "second question"},
            {"role": "assistant", "content": "second answer"},
            {"role": "user", "content": "third question"},
            {"role": "assistant", "content": "third answer"},
        ],
    }
    assert instance._saved_message_counts["session-semantic-append"] == 6


def test_pending_messages_are_isolated_by_session():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-a"
    instance._saved_message_count = 0

    instance.sync_turn("a1", "a2", session_id="session-a")
    instance._client.fail_append = True
    instance.sync_turn("a3", "a4", session_id="session-a")
    instance._client.fail_append = False

    instance.on_session_switch("session-b", parent_session_id="session-a", reset=True)
    instance.sync_turn("b1", "b2", session_id="session-b")

    assert instance._client.import_calls[-1] == {
        "thread_id": "session-b",
        "messages": [
            {"role": "user", "content": "b1"},
            {"role": "assistant", "content": "b2"},
        ],
        "title": "b1",
        "source": "hermes",
    }

    instance.on_session_switch("session-a", parent_session_id="session-b", reset=False)
    instance.sync_turn("a5", "a6", session_id="session-a")

    assert instance._client.append_calls == [
        {
            "thread_id": "session-a",
            "messages": [
                {"role": "user", "content": "a3"},
                {"role": "assistant", "content": "a4"},
                {"role": "user", "content": "a5"},
                {"role": "assistant", "content": "a6"},
            ],
        }
    ]


def test_ambiguous_append_failure_retries_exact_payload_without_advancing_count():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._cron_skipped = False
    instance._session_id = "session-ambiguous"
    instance._saved_message_count = 0

    instance.sync_turn("first question", "first answer", session_id="session-ambiguous")
    instance._client.fail_append_after_recording = True
    instance.sync_turn("second question", "second answer", session_id="session-ambiguous")

    assert instance._saved_message_counts["session-ambiguous"] == 2
    first_attempt = instance._client.append_calls[-1]["messages"]

    instance._client.fail_append_after_recording = False
    instance.sync_turn("third question", "third answer", session_id="session-ambiguous")

    assert instance._client.append_calls[-1] == {
        "thread_id": "session-ambiguous",
        "messages": [
            *first_attempt,
            {"role": "user", "content": "third question"},
            {"role": "assistant", "content": "third answer"},
        ],
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


@pytest.mark.parametrize("append", [False, True])
def test_retry_snapshot_preserves_repeated_pending_sequence_and_middle_messages(append):
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._session_id = "repeated-snapshot"
    pending = [{"role": "user", "content": "A"}, {"role": "assistant", "content": "B"}]
    history = [
        *pending,
        {"role": "user", "content": "C"},
        *pending,
        {"role": "assistant", "content": "D"},
    ]
    prefix = [{"role": "user", "content": "acknowledged"}] if append else []
    if append:
        instance.on_session_end(prefix)
    instance._client.fail_import = True
    instance._client.fail_append = True
    instance.on_session_end([*prefix, *pending])
    instance._client.fail_import = False
    instance._client.fail_append = False
    instance.on_session_end([*prefix, *history])
    calls = instance._client.append_calls if append else instance._client.import_calls
    assert calls[-1]["messages"] == history
    assert instance._saved_message_count == len(prefix) + len(history)
    instance.on_session_end([*prefix, *history])
    assert len(calls) == 1


def test_delta_recovery_uses_observed_boundary_with_repeated_parent_and_branch_text():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._session_id = "parent"
    turn = [{"role": "user", "content": "A"}, {"role": "assistant", "content": "B"}]
    parent = [*turn, {"role": "user", "content": "parent only"}]
    branch = [
        *turn,
        {"role": "user", "content": "C"},
        *turn,
        {"role": "assistant", "content": "D"},
    ]
    instance.on_session_switch("branch", reset=False)
    instance._client.fail_import = True
    instance.sync_turn("A", "B", messages=[*parent, *turn])
    instance._client.fail_import = False
    instance.on_session_end([*parent, *branch])
    assert instance._client.import_calls[-1]["messages"] == branch
    assert instance._saved_message_count == len(branch)
    instance.on_session_end([*parent, *branch])
    assert instance._client.append_calls == []


def test_ambiguous_delta_recovery_retains_pending_until_unique_alignment():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._session_id = "parent"
    instance.on_session_switch("branch", reset=False)
    turn = [{"role": "user", "content": "A"}, {"role": "assistant", "content": "B"}]
    history = [*turn, {"role": "user", "content": "parent only"}, *turn]
    instance._client.fail_import = True
    instance.sync_turn("A", "B")
    instance.on_session_end(history)
    assert instance._pending_message_batches["branch"] == turn
    assert instance._saved_message_count == 0
    instance._client.fail_import = False
    instance.on_session_end(history)
    assert instance._client.import_calls == []
    assert instance._pending_message_batches["branch"] == turn
    instance._client.fail_import = True
    instance.sync_turn("C", "D")
    instance._client.fail_import = False
    tail = [{"role": "user", "content": "C"}, {"role": "assistant", "content": "D"}]
    instance.on_session_end([*history, *tail])
    assert instance._client.import_calls[-1]["messages"] == [*turn, *tail]
    assert instance._saved_message_count == 4


def test_merge_retains_session_scoped_prefix_before_pending_sequence():
    instance = provider.NowledgeMemProvider()
    pending = [{"role": "user", "content": "A"}, {"role": "assistant", "content": "B"}]
    history = [{"role": "user", "content": "earlier"}, *pending]
    assert instance._merge_message_sequences(pending, history) == history


def test_observed_branch_boundary_rejects_changed_prefix_and_clears_on_reset():
    instance = provider.NowledgeMemProvider()
    instance._client = FakeClient()
    instance._session_id = "parent"
    instance.on_session_switch("branch", reset=False)
    turn = [{"role": "user", "content": "A"}, {"role": "assistant", "content": "B"}]
    parent = [{"role": "user", "content": "parent only"}]
    instance._client.fail_import = True
    instance.sync_turn("A", "B", messages=[*parent, *turn])
    instance._client.fail_import = False
    instance.on_session_end([{"role": "user", "content": "changed parent"}, *turn])
    assert instance._client.import_calls == []
    assert instance._pending_message_batches["branch"] == turn
    assert instance._saved_message_count == 0
    instance.on_session_switch("other", reset=False)
    instance._client.fail_import = True
    instance.sync_turn("other question", "other answer")
    instance._client.fail_import = False
    other = [
        {"role": "user", "content": "other question"},
        {"role": "assistant", "content": "other answer"},
    ]
    instance.on_session_end(other)
    assert instance._client.import_calls[-1]["messages"] == other
    instance.on_session_switch("branch", reset=True)
    assert "branch" not in instance._delta_parent_signatures
    assert "branch" not in instance._pending_message_batches
    instance.on_session_end(turn)
    assert instance._client.import_calls[-1]["messages"] == turn


def test_shutdown_clears_all_session_recovery_state():
    instance = provider.NowledgeMemProvider()
    instance._session_id = "branch"
    instance._saved_message_count = 2
    instance._saved_message_counts["branch"] = 2
    instance._delta_only_sessions.add("branch")
    instance._written_message_signatures["branch"] = ["user\0written"]
    instance._pending_message_batches["branch"] = [
        {"role": "user", "content": "pending"}
    ]
    instance._delta_parent_signatures["branch"] = ["user\0parent"]

    instance.shutdown()

    assert instance._session_id == ""
    assert instance._saved_message_count == 0
    assert instance._saved_message_counts == {}
    assert instance._delta_only_sessions == set()
    assert instance._written_message_signatures == {}
    assert instance._pending_message_batches == {}
    assert instance._delta_parent_signatures == {}
