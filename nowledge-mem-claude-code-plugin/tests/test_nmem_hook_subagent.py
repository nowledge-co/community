import importlib.util
import io
import json
from pathlib import Path
from unittest import mock

import pytest


PLUGIN_ROOT = Path(__file__).parent.parent
SCRIPT_PATH = PLUGIN_ROOT / "scripts" / "nmem-hook-subagent.py"
HOOKS_PATH = PLUGIN_ROOT / "hooks" / "hooks.json"


def _load_module():
    spec = importlib.util.spec_from_file_location("nmem_hook_subagent", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(autouse=True)
def _clear_subagent_context_override(monkeypatch):
    monkeypatch.delenv("NMEM_SUBAGENT_CONTEXT_TYPES", raising=False)


def test_packaged_subagent_hook_uses_bounded_wrapper():
    hooks = json.loads(HOOKS_PATH.read_text(encoding="utf-8"))["hooks"]
    hook_group = hooks["SubagentStart"][0]
    hook = hook_group["hooks"][0]

    assert hook_group["matcher"] == ".*"
    assert "nmem-hook-subagent.py" in hook["command"]
    assert hook["timeout"] > _load_module().SUBAGENT_CONTEXT_TIMEOUT_SECONDS


def test_grok_subagent_start_skips_passive_context_output():
    module = _load_module()
    stdout = io.StringIO()

    with mock.patch.dict(
        module.os.environ,
        {"GROK_HOOK_EVENT": "subagent_start"},
    ), mock.patch.object(module, "_load_context") as load, \
         mock.patch.object(module.sys, "stdout", stdout):
        assert module.main(
            {"hookEventName": "subagent_start", "subagentType": "architect"}
        ) == 0

    load.assert_not_called()
    assert stdout.getvalue() == ""


def test_selected_subagent_injects_bounded_context_and_boundary():
    module = _load_module()
    stdout = io.StringIO()
    oversized_context = "context-内容\n" * 1000

    with mock.patch.object(module, "_load_context", return_value=oversized_context), \
         mock.patch.object(module.sys, "stdout", stdout):
        assert module.main(
            {"hook_event_name": "SubagentStart", "agent_type": "Plan"}
        ) == 0

    output = json.loads(stdout.getvalue())["hookSpecificOutput"]
    additional_context = output["additionalContext"]
    assert output["hookEventName"] == "SubagentStart"
    assert "isolated subagent context" in additional_context
    assert "memory_search` / `thread_search" in additional_context
    assert "nmem --json m search" in additional_context
    assert "Do not distill speculative" in additional_context
    assert "Current Nowledge context" in additional_context
    assert "context truncated for subagent" in additional_context
    assert len(additional_context.encode("utf-8")) <= module.SUBAGENT_CONTEXT_MAX_BYTES


def test_selected_subagent_keeps_guidance_when_context_is_unavailable():
    module = _load_module()
    stdout = io.StringIO()

    with mock.patch.object(module, "_load_context", return_value=""), \
         mock.patch.object(module.sys, "stdout", stdout):
        assert module.main(
            {"hook_event_name": "SubagentStart", "agent_type": "architect"}
        ) == 0

    additional_context = json.loads(stdout.getvalue())["hookSpecificOutput"][
        "additionalContext"
    ]
    assert "isolated subagent context" in additional_context
    assert "Current Nowledge context" not in additional_context


def test_general_purpose_subagent_gets_routing_without_loading_context():
    module = _load_module()
    stdout = io.StringIO()

    with mock.patch.object(module, "_load_context") as load, \
         mock.patch.object(module.sys, "stdout", stdout):
        assert module.main(
            {"hook_event_name": "SubagentStart", "agent_type": "general-purpose"}
        ) == 0

    load.assert_not_called()
    additional_context = json.loads(stdout.getvalue())["hookSpecificOutput"][
        "additionalContext"
    ]
    assert "subagent routing" in additional_context
    assert "Current Nowledge context" not in additional_context


def test_explore_subagent_skips_memory_prompt_by_default():
    module = _load_module()
    stdout = io.StringIO()

    with mock.patch.object(module, "_load_context") as load, \
         mock.patch.object(module.sys, "stdout", stdout):
        assert module.main(
            {"hook_event_name": "SubagentStart", "agent_type": "Explore"}
        ) == 0

    load.assert_not_called()
    assert stdout.getvalue() == ""


def test_context_types_override_replaces_default_allowlist():
    module = _load_module()
    stdout = io.StringIO()

    with mock.patch.dict(
        module.os.environ,
        {"NMEM_SUBAGENT_CONTEXT_TYPES": "general-purpose, Explore"},
    ), mock.patch.object(module, "_load_context", return_value="selected context"), \
         mock.patch.object(module.sys, "stdout", stdout):
        assert module.main(
            {"hook_event_name": "SubagentStart", "agent_type": "general-purpose"}
        ) == 0

    additional_context = json.loads(stdout.getvalue())["hookSpecificOutput"][
        "additionalContext"
    ]
    assert "selected context" in additional_context
    assert module._context_types() == module.DEFAULT_SUBAGENT_CONTEXT_TYPES


def test_empty_context_types_disables_full_context():
    module = _load_module()
    stdout = io.StringIO()

    with mock.patch.dict(
        module.os.environ,
        {"NMEM_SUBAGENT_CONTEXT_TYPES": ""},
    ), mock.patch.object(module, "_load_context") as load, \
         mock.patch.object(module.sys, "stdout", stdout):
        assert module.main(
            {"hook_event_name": "SubagentStart", "agent_type": "architect"}
        ) == 0

    load.assert_not_called()
    additional_context = json.loads(stdout.getvalue())["hookSpecificOutput"][
        "additionalContext"
    ]
    assert "subagent routing" in additional_context
    assert "injected Nowledge context" not in additional_context


def test_subagent_context_truncation_preserves_utf8():
    module = _load_module()

    result = module._truncate_utf8("界" * 2000, 101)

    assert len(result.encode("utf-8")) <= 101
    assert "context truncated for subagent" in result
