import importlib.util
from pathlib import Path
from unittest import mock


HOOK = Path(__file__).resolve().parents[1] / "hooks" / "save-to-nmem.py"


def load_hook():
    spec = importlib.util.spec_from_file_location("proma_save_to_nmem", HOOK)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_enqueue_command_uses_shared_capture_queue(tmp_path):
    hook = load_hook()
    transcript = tmp_path / "session.jsonl"
    assert hook.build_enqueue_command("nmem", "session-1", transcript, "/workspace") == [
        "nmem",
        "--json",
        "t",
        "capture",
        "--from",
        "proma",
        "--session-id",
        "session-1",
        "--project",
        "/workspace",
        "--transcript-path",
        str(transcript),
        "--sync",
        "--all-projects",
    ]


def test_successful_enqueue_skips_full_jsonl_parse(tmp_path):
    hook = load_hook()
    transcript = tmp_path / "session.jsonl"
    transcript.write_text("{}\n", encoding="utf-8")
    with mock.patch.object(
        hook,
        "read_hook_input",
        return_value={"session_id": "session-1", "cwd": str(tmp_path)},
    ), mock.patch.object(hook, "find_session_file", return_value=transcript), mock.patch.object(
        hook, "enqueue_capture", return_value=True
    ), mock.patch.object(hook, "parse_session_messages") as parse, mock.patch.object(hook, "log"):
        assert hook.main() == 0
    parse.assert_not_called()
