"""Fixture tests for copilot-stop-save.py transcript parsing and capture logic.

Tests cover:
- Event extraction from transcript JSONL
- Message collection and merging
- Secret filtering and redaction
- Sensitive content detection
- Incomplete turn detection
- Content hash deduplication
- Title generation
- State management
"""

import json
import io
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add hooks/ to path so we can import the packaged capture module
sys.path.insert(
    0, str(Path(__file__).parent.parent / "hooks")
)

# Rename the module for import (Python doesn't like hyphens in module names)
import importlib.util
_spec = importlib.util.spec_from_file_location(
    "copilot_stop_save",
    Path(__file__).parent.parent / "hooks" / "copilot-stop-save.py",
)
copilot_stop_save = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(copilot_stop_save)


def test_script_compatibility_launchers_delegate_to_packaged_hook():
    repo_root = Path(__file__).parent.parent
    python_launcher = (repo_root / "scripts" / "copilot-stop-save.py").read_text()
    shell_launcher = (repo_root / "scripts" / "copilot-stop-save.sh").read_text()

    assert "hooks\" / \"copilot-stop-save.py" in python_launcher
    assert "../hooks/copilot-stop-save.sh" in shell_launcher


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def make_event(etype, content=None, event_id=None, tool_name=None,
               arguments=None, tool_call_id=None, result=None,
               turn_id=None, timestamp=None):
    """Build a transcript event dict."""
    event = {"type": etype}
    if event_id:
        event["id"] = event_id
    if timestamp:
        event["timestamp"] = timestamp
    data = {}
    if content is not None:
        data["content"] = content
    if tool_name is not None:
        data["toolName"] = tool_name
    if arguments is not None:
        data["arguments"] = arguments
    if tool_call_id is not None:
        data["toolCallId"] = tool_call_id
    if result is not None:
        data["result"] = result
    if turn_id is not None:
        data["turnId"] = turn_id
    if data:
        event["data"] = data
    return event


def basic_transcript():
    """A minimal valid transcript with one user message and one assistant response."""
    return [
        make_event("user.message", content="How do I use React hooks?", event_id="e1"),
        make_event("assistant.turn_start", event_id="e2"),
        make_event("assistant.message", content="Here's how to use React hooks effectively...", event_id="e3"),
        make_event("assistant.turn_end", event_id="e4", turn_id="turn-1"),
    ]


def multi_turn_transcript():
    """A transcript with multiple user/assistant turns."""
    return [
        make_event("user.message", content="What's the best database for my project?", event_id="e1"),
        make_event("assistant.turn_start", event_id="e2"),
        make_event("assistant.message", content="It depends on your requirements. PostgreSQL is great for ACID compliance.", event_id="e3"),
        make_event("assistant.turn_end", event_id="e4", turn_id="turn-1"),
        make_event("user.message", content="I need transactions and complex queries.", event_id="e5"),
        make_event("assistant.turn_start", event_id="e6"),
        make_event("assistant.message", content="Then PostgreSQL is the right choice. Decision: chose PostgreSQL over MongoDB for ACID.", event_id="e7"),
        make_event("assistant.turn_end", event_id="e8", turn_id="turn-2"),
    ]


# ---------------------------------------------------------------------------
# Tests: Message Collection
# ---------------------------------------------------------------------------


class TestCollectMessages:
    def test_basic_collection(self):
        events = basic_transcript()
        messages = copilot_stop_save.collect_messages(events)
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"

    def test_merges_consecutive_same_role(self):
        events = [
            make_event("user.message", content="Part 1"),
            make_event("user.message", content="Part 2"),
            make_event("assistant.turn_start"),
            make_event("assistant.message", content="Response"),
            make_event("assistant.turn_end"),
        ]
        messages = copilot_stop_save.collect_messages(events)
        assert len(messages) == 2
        assert "Part 1" in messages[0]["content"]
        assert "Part 2" in messages[0]["content"]

    def test_skips_empty_messages(self):
        events = [
            make_event("user.message", content=""),
            make_event("user.message", content="Actual question"),
            make_event("assistant.turn_start"),
            make_event("assistant.message", content="Answer"),
            make_event("assistant.turn_end"),
        ]
        messages = copilot_stop_save.collect_messages(events)
        assert len(messages) == 2
        assert messages[0]["content"] == "Actual question"

    def test_ignores_non_message_events(self):
        events = [
            make_event("user.message", content="Question"),
            make_event("tool.execution_start", tool_name="bash"),
            make_event("tool.execution_complete"),
            make_event("assistant.turn_start"),
            make_event("assistant.message", content="Answer"),
            make_event("assistant.turn_end"),
        ]
        messages = copilot_stop_save.collect_messages(events)
        assert len(messages) == 2


# ---------------------------------------------------------------------------
# Tests: Secret Filtering
# ---------------------------------------------------------------------------


class TestSecretFiltering:
    def test_redacts_github_token(self):
        text = "Use token ghp_1234567890abcdefghijklmn"
        result = copilot_stop_save.redact(text)
        assert "ghp_1234567890abcdefghijklmn" not in result
        assert "[REDACTED]" in result

    def test_redacts_github_pat(self):
        text = "Token: github_pat_1234567890abcdefghijklmn"
        result = copilot_stop_save.redact(text)
        assert "github_pat_1234567890abcdefghijklmn" not in result
        assert "[REDACTED]" in result

    def test_redacts_openai_key(self):
        text = "API key is sk-1234567890abcdefgh"
        result = copilot_stop_save.redact(text)
        assert "sk-1234567890abcdefgh" not in result
        assert "[REDACTED]" in result

    def test_redacts_bearer_token(self):
        text = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test"
        result = copilot_stop_save.redact(text)
        assert "Bearer eyJhbGciOiJIUzI1NiJ9.test" not in result
        assert "[REDACTED]" in result

    def test_preserves_normal_text(self):
        text = "This is a normal message about coding."
        result = copilot_stop_save.redact(text)
        assert result == text


class TestSensitiveContentDetection:
    def test_detects_private_key(self):
        text = "-----BEGIN RSA PRIVATE KEY-----\nMIIE..."
        assert copilot_stop_save.has_sensitive_content(text)

    def test_detects_ssh_key(self):
        text = "ssh-rsa " + "A" * 100
        assert copilot_stop_save.has_sensitive_content(text)

    def test_detects_aws_key(self):
        text = "AKIAIOSFODNN7EXAMPLE"
        assert copilot_stop_save.has_sensitive_content(text)

    def test_detects_jwt(self):
        text = "eyJhbGciOiJ.eyJzdWIiOiIx.SflKxwRJSMeKKF2QT4f"
        assert copilot_stop_save.has_sensitive_content(text)

    def test_detects_connection_string(self):
        text = "postgres://user:pass@host/db"
        assert copilot_stop_save.has_sensitive_content(text)

    def test_skips_placeholder_values(self):
        text = "api_key = placeholder_value_here"
        assert not copilot_stop_save.has_sensitive_content(text)

    def test_normal_text_not_sensitive(self):
        text = "Just discussing database architecture options."
        assert not copilot_stop_save.has_sensitive_content(text)


# ---------------------------------------------------------------------------
# Tests: Text Cleaning
# ---------------------------------------------------------------------------


class TestTextCleaning:
    def test_strip_wrappers_removes_tag_blocks(self):
        text = "<current_datetime>2026-01-01</current_datetime>Hello world"
        result = copilot_stop_save.strip_wrappers(text)
        assert "current_datetime" not in result
        assert "Hello world" in result

    def test_strip_wrappers_removes_tag_lines(self):
        text = "<some_tag>\nHello world\n</some_tag>"
        result = copilot_stop_save.strip_wrappers(text)
        assert "Hello world" in result

    def test_clean_user_text_redacts_and_strips(self):
        event = make_event(
            "user.message",
            content="<reminder>test</reminder>My token is ghp_1234567890abcdefghijklmn"
        )
        result = copilot_stop_save.clean_user_text(event)
        assert "reminder" not in result
        assert "[REDACTED]" in result

    def test_clean_assistant_text_redacts(self):
        event = make_event(
            "assistant.message",
            content="Here's your key: sk-abcdefghijklmnopqr"
        )
        result = copilot_stop_save.clean_assistant_text(event)
        assert "[REDACTED]" in result


# ---------------------------------------------------------------------------
# Tests: Input Extraction
# ---------------------------------------------------------------------------


class TestExtractInput:
    def test_direct_input(self):
        payload = {"input": {"sessionId": "s1", "transcriptPath": "/tmp/t.jsonl"}}
        result = copilot_stop_save.extract_input(payload)
        assert result["sessionId"] == "s1"

    def test_nested_data_input(self):
        payload = {"data": {"input": {"sessionId": "s1"}}}
        result = copilot_stop_save.extract_input(payload)
        assert result["sessionId"] == "s1"

    def test_data_fallback(self):
        payload = {"data": {"sessionId": "s1"}}
        result = copilot_stop_save.extract_input(payload)
        assert result["sessionId"] == "s1"

    def test_empty_payload(self):
        result = copilot_stop_save.extract_input({})
        assert result == {}

    def test_input_value_accepts_snake_and_camel_case(self):
        payload = {
            "session_id": "snake-session",
            "sessionId": "camel-session",
            "transcript_path": "/tmp/snake.jsonl",
        }
        assert (
            copilot_stop_save.input_value(payload, "session_id", "sessionId")
            == "snake-session"
        )
        assert (
            copilot_stop_save.input_value(payload, "transcriptPath", "transcript_path")
            == "/tmp/snake.jsonl"
        )

    def test_normalize_hook_event(self):
        assert copilot_stop_save.normalize_hook_event("PreCompact") == "precompact"
        assert copilot_stop_save.normalize_hook_event("pre-compact") == "precompact"


# ---------------------------------------------------------------------------
# Tests: Title Generation
# ---------------------------------------------------------------------------


class TestTitleGeneration:
    def test_title_from_first_user_message(self):
        messages = [
            {"role": "user", "content": "How do I use React hooks?"},
            {"role": "assistant", "content": "Here's how..."},
        ]
        title = copilot_stop_save.title_from_messages(messages)
        assert "React hooks" in title

    def test_title_truncated_at_96(self):
        messages = [
            {"role": "user", "content": "A" * 200},
            {"role": "assistant", "content": "Response"},
        ]
        title = copilot_stop_save.title_from_messages(messages)
        assert len(title) <= 96

    def test_title_fallback_no_user(self):
        messages = [{"role": "assistant", "content": "Hello"}]
        title = copilot_stop_save.title_from_messages(messages)
        assert title == "GitHub Copilot CLI request"


# ---------------------------------------------------------------------------
# Tests: Content Hash
# ---------------------------------------------------------------------------


class TestContentHash:
    def test_same_content_same_hash(self):
        msgs = [{"role": "user", "content": "test"}]
        h1 = copilot_stop_save.content_hash(msgs)
        h2 = copilot_stop_save.content_hash(msgs)
        assert h1 == h2

    def test_different_content_different_hash(self):
        msgs1 = [{"role": "user", "content": "test1"}]
        msgs2 = [{"role": "user", "content": "test2"}]
        assert copilot_stop_save.content_hash(msgs1) != copilot_stop_save.content_hash(msgs2)

    def test_hash_length(self):
        msgs = [{"role": "user", "content": "test"}]
        assert len(copilot_stop_save.content_hash(msgs)) == 16


# ---------------------------------------------------------------------------
# Tests: State Management
# ---------------------------------------------------------------------------


class TestStateManagement:
    def test_load_state_new_session(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(copilot_stop_save, "STATE_DIR", Path(tmpdir)):
                _path, state = copilot_stop_save.load_state("new-session")
                assert state["active_start_event_id"] is None
                assert state["last_saved_turn_end_id"] is None
                assert state["last_distill_ts"] == 0
                assert state["last_content_hash"] is None

    def test_save_and_load_state(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(copilot_stop_save, "STATE_DIR", Path(tmpdir)):
                path, state = copilot_stop_save.load_state("test-session")
                state["last_saved_turn_end_id"] = "e4"
                state["last_distill_ts"] = 1000
                state["last_content_hash"] = "abc123"
                copilot_stop_save.save_state(path, state)

                _path2, state2 = copilot_stop_save.load_state("test-session")
                assert state2["last_saved_turn_end_id"] == "e4"
                assert state2["last_distill_ts"] == 1000
                assert state2["last_content_hash"] == "abc123"

    def test_state_token_is_filesystem_safe(self):
        token = copilot_stop_save.state_token("../nested/session")
        assert "/" not in token
        assert "." not in token
        assert len(token) == 32


# ---------------------------------------------------------------------------
# Tests: Event Helpers
# ---------------------------------------------------------------------------


class TestEventHelpers:
    def test_find_index_found(self):
        events = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
        assert copilot_stop_save.find_index(events, "b") == 1

    def test_find_index_not_found(self):
        events = [{"id": "a"}, {"id": "b"}]
        assert copilot_stop_save.find_index(events, "z") is None

    def test_find_index_none_id(self):
        events = [{"id": "a"}]
        assert copilot_stop_save.find_index(events, None) is None

    def test_event_timestamp_ms(self):
        event = {"timestamp": "2026-07-14T10:00:00Z"}
        ts = copilot_stop_save.event_timestamp_ms(event)
        assert isinstance(ts, int)
        assert ts > 0

    def test_event_timestamp_ms_none(self):
        event = {}
        assert copilot_stop_save.event_timestamp_ms(event) is None


# ---------------------------------------------------------------------------
# Tests: Transcript Loading
# ---------------------------------------------------------------------------


class TestTranscriptLoading:
    def test_load_events_from_jsonl(self):
        events = basic_transcript()
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            for event in events:
                f.write(json.dumps(event) + "\n")
            f.flush()
        try:
            loaded = copilot_stop_save.load_events(f.name)
            assert len(loaded) == len(events)
            assert loaded[0]["type"] == "user.message"
        finally:
            os.unlink(f.name)


# ---------------------------------------------------------------------------
# Tests: Main Capture Entrypoint
# ---------------------------------------------------------------------------


class TestMainCaptureEntrypoint:
    def _write_transcript(self, events):
        f = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
        for event in events:
            f.write(json.dumps(event) + "\n")
        f.flush()
        f.close()
        return f.name

    def test_main_accepts_snake_case_stop_payload(self):
        transcript_path = self._write_transcript(multi_turn_transcript())
        with tempfile.TemporaryDirectory() as tmpdir:
            payload = {
                "session_id": "snake-session",
                "transcript_path": transcript_path,
                "hook_event_name": "Stop",
                "stop_reason": "end_turn",
                "timestamp": "2026-04-27T10:00:00Z",
            }
            try:
                with patch.object(copilot_stop_save, "STATE_DIR", Path(tmpdir) / "state"), \
                    patch.object(copilot_stop_save, "LOG_FILE", Path(tmpdir) / "hook-log.jsonl"), \
                    patch("shutil.which", return_value="nmem"), \
                    patch.object(copilot_stop_save, "run_json", return_value={}) as run_json, \
                    patch.object(sys, "stdin", io.StringIO(json.dumps(payload))), \
                    patch.object(sys, "argv", ["copilot-stop-save.py"]):
                    assert copilot_stop_save.main() == 0
                    assert run_json.called
            finally:
                os.unlink(transcript_path)

    def test_precompact_saves_even_when_latest_turn_is_not_final(self):
        events = [
            make_event("user.message", content="We need a checkpoint before compaction.", event_id="e1"),
            make_event("assistant.turn_start", event_id="e2"),
            make_event(
                "assistant.message",
                content="I can do that. What would you like me to preserve?",
                event_id="e3",
            ),
            make_event("assistant.turn_end", event_id="e4", turn_id="turn-1"),
        ]
        transcript_path = self._write_transcript(events)
        with tempfile.TemporaryDirectory() as tmpdir:
            payload = {
                "session_id": "precompact-session",
                "transcript_path": transcript_path,
                "hook_event_name": "PreCompact",
                "timestamp": "2026-04-27T10:00:00Z",
            }
            try:
                with patch.object(copilot_stop_save, "STATE_DIR", Path(tmpdir) / "state"), \
                    patch.object(copilot_stop_save, "LOG_FILE", Path(tmpdir) / "hook-log.jsonl"), \
                    patch("shutil.which", return_value="nmem"), \
                    patch.object(copilot_stop_save, "run_json", return_value={}) as run_json, \
                    patch.object(sys, "stdin", io.StringIO(json.dumps(payload))), \
                    patch.object(sys, "argv", ["copilot-stop-save.py", "--event", "pre-compact"]):
                    assert copilot_stop_save.main() == 0
                    assert run_json.called
            finally:
                os.unlink(transcript_path)


# ---------------------------------------------------------------------------
# Tests: Signal Detection
# ---------------------------------------------------------------------------


class TestSignalDetection:
    def test_signal_re_matches_decision(self):
        assert copilot_stop_save.SIGNAL_RE.search("We made a decision to use X")

    def test_signal_re_matches_rationale(self):
        assert copilot_stop_save.SIGNAL_RE.search("The rationale was performance")

    def test_signal_re_matches_chinese(self):
        assert copilot_stop_save.SIGNAL_RE.search("我们的决定是使用PostgreSQL")

    def test_incomplete_re_matches_question(self):
        assert copilot_stop_save.INCOMPLETE_RE.search("What would you like me to do?")

    def test_incomplete_re_matches_chinese(self):
        assert copilot_stop_save.INCOMPLETE_RE.search("请确认一下")


# ---------------------------------------------------------------------------
# Tests: nmem Command Building
# ---------------------------------------------------------------------------


class TestBuildNmemCommand:
    def test_unix_command(self):
        cmd = copilot_stop_save.build_nmem_command("/usr/local/bin/nmem", "--json", "wm", "read")
        assert cmd == ["/usr/local/bin/nmem", "--json", "wm", "read"]

    def test_windows_cmd(self):
        cmd = copilot_stop_save.build_nmem_command("C:\\nmem.cmd", "--json", "wm", "read")
        assert cmd[0] == "cmd.exe"
        assert cmd[1] == "/s"
        assert cmd[2] == "/c"
