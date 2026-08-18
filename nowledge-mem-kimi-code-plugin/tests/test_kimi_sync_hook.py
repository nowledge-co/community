import importlib.util
from pathlib import Path
from unittest import mock


HOOK = Path(__file__).resolve().parents[1] / "scripts" / "kimi-sync-hook.py"


def load_hook():
    spec = importlib.util.spec_from_file_location("kimi_sync_hook", HOOK)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_enqueue_command_uses_shared_capture_worker():
    hook = load_hook()
    assert hook._build_enqueue_command("session-1") == [
        "nmem",
        "--json",
        "t",
        "capture",
        "--from",
        "kimi-code",
        "--session-id",
        "session-1",
        "--sync",
        "--all-projects",
    ]


def test_successful_enqueue_is_acknowledged():
    hook = load_hook()
    completed = mock.Mock(returncode=0, stdout='{"status":"enqueued"}', stderr="")
    with mock.patch.object(
        hook,
        "_read_payload",
        return_value={"session_id": "session-1", "hook_event_name": "Stop"},
    ), mock.patch.object(hook, "_run_enqueue", return_value=completed), mock.patch.object(
        hook, "_log"
    ):
        assert hook.main() == 0


def test_zero_exit_without_enqueue_ack_skips_capture():
    hook = load_hook()
    not_enqueued = mock.Mock(
        returncode=0,
        stdout='{"status":"success","results":[]}',
        stderr="",
    )
    with mock.patch.object(
        hook,
        "_read_payload",
        return_value={"session_id": "session-1", "hook_event_name": "Stop"},
    ), mock.patch.object(hook, "_run_enqueue", return_value=not_enqueued), mock.patch.object(
        hook, "_log"
    ) as log:
        assert hook.main() == 0
    assert any("enqueue rejected" in call.args[0] for call in log.call_args_list)
