import importlib.util
import json
from pathlib import Path
from unittest import mock


HOOK = Path(__file__).resolve().parents[1] / "scripts" / "codebuddy-sync-hook.py"


def load_hook():
    spec = importlib.util.spec_from_file_location("codebuddy_sync_hook", HOOK)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_enqueue_command_uses_exact_transcript_and_shared_queue():
    hook = load_hook()
    assert hook._build_enqueue_command("workbuddy", "session-1", "C:\\sessions\\one.jsonl") == [
        "nmem",
        "--json",
        "t",
        "capture",
        "--from",
        "workbuddy",
        "--session-id",
        "session-1",
        "--transcript-path",
        "C:\\sessions\\one.jsonl",
        "--sync",
        "--all-projects",
    ]


def test_successful_enqueue_is_acknowledged(tmp_path):
    hook = load_hook()
    transcript = tmp_path / "session.jsonl"
    transcript.write_text("{}\n", encoding="utf-8")
    payload = {
        "session_id": "session-1",
        "transcript_path": str(transcript),
        "hook_event_name": "Stop",
    }
    completed = mock.Mock(returncode=0, stdout='{"status":"enqueued"}', stderr="")
    with mock.patch.object(hook, "_read_payload", return_value=payload), \
         mock.patch.object(hook, "_run_enqueue", return_value=completed), \
         mock.patch.object(hook, "_log"):
        assert hook.main() == 0


def test_zero_exit_without_enqueue_ack_does_not_run_full_sync(tmp_path):
    hook = load_hook()
    transcript = tmp_path / "session.jsonl"
    transcript.write_text("{}\n", encoding="utf-8")
    payload = {
        "session_id": "session-1",
        "transcript_path": str(transcript),
        "hook_event_name": "Stop",
    }
    not_enqueued = mock.Mock(
        returncode=0,
        stdout='{"status":"success","results":[]}',
        stderr="",
    )
    with mock.patch.object(hook, "_read_payload", return_value=payload), \
         mock.patch.object(hook, "_run_enqueue", return_value=not_enqueued), \
         mock.patch.object(hook, "_log") as log:
        assert hook.main() == 0
    assert any("enqueue rejected" in call.args[1] for call in log.call_args_list)
