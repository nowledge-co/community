import importlib.util
from pathlib import Path


SCRIPT_PATH = Path(__file__).parent.parent / "scripts" / "nmem-hook-save.py"

spec = importlib.util.spec_from_file_location("nmem_hook_save", SCRIPT_PATH)
nmem_hook_save = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(nmem_hook_save)


def test_build_command_uses_unix_nmem_directly(tmp_path):
    command = nmem_hook_save._build_command(
        "/usr/local/bin/nmem",
        {"session_id": " claude-session ", "cwd": str(tmp_path)},
    )

    assert command == [
        "/usr/local/bin/nmem",
        "t",
        "save",
        "--from",
        "claude-code",
        "--truncate",
        "--session-id",
        "claude-session",
        "--project",
        str(tmp_path),
    ]


def test_build_command_wraps_windows_cmd_for_wsl_bridge():
    command = nmem_hook_save._build_command(
        "/mnt/c/Users/Alice/AppData/Roaming/npm/nmem.cmd",
        {"session_id": "session-1"},
    )

    assert command[:3] == ["cmd.exe", "/s", "/c"]
    assert "C:\\Users\\Alice\\AppData\\Roaming\\npm\\nmem.cmd" in command[3]
    assert "/mnt/c/" not in command[3]
    assert "--session-id session-1" in command[3]

