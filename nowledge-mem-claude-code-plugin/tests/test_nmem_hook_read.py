import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent.parent / "scripts" / "nmem-hook-read.sh"


def _write_fake_nmem(
    bin_dir: Path,
    content: str,
    *,
    calls: Path | None = None,
    fail_context: bool = False,
) -> Path:
    script = bin_dir / "fake_nmem.py"
    response = {"exists": True, "content": content}
    script.write_text(
        f"#!{sys.executable}\n"
        "import json, sys\n"
        + (
            f"with open({str(calls)!r}, 'a', encoding='utf-8') as record:\n"
            "    record.write(json.dumps(sys.argv[1:]) + '\\n')\n"
            if calls
            else ""
        )
        + ("if 'context' in sys.argv[1:]:\n    sys.exit(2)\n" if fail_context else "")
        + f"print(json.dumps({response!r}))\n",
        encoding="utf-8",
    )
    if os.name == "nt":
        # The hook now uses native Python, so its fixture must be a native shim.
        cli = bin_dir / "nmem.cmd"
        cli.write_text(
            f'@echo off\n"{sys.executable}" "{script}" %*\n', encoding="utf-8"
        )
    else:
        cli = bin_dir / "nmem"
        cli.write_text(script.read_text(encoding="utf-8"), encoding="utf-8")
    cli.chmod(0o755)
    return cli


def _cli_path(bin_dir: Path) -> str:
    return str(bin_dir) + os.pathsep + os.environ["PATH"]


def _run_hook(
    tmp_path: Path, *, cwd: Path, env: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    shell = shutil.which("sh")
    assert shell is not None, "sh is required to exercise the packaged hook"
    hook_env = os.environ.copy()
    for name in tuple(hook_env):
        if name.startswith(("NMEM_", "GROK_", "WSL_")) or name == "CLAUDE_PLUGIN_ROOT":
            hook_env.pop(name)
    hook_env.update(env)
    hook_env["HOME"] = str(tmp_path / "home")
    (Path(hook_env["HOME"]) / "ai-now").mkdir(parents=True, exist_ok=True)
    hook_env["NMEM_AI_NOW_HOME"] = str(Path(hook_env["HOME"]) / "ai-now")
    return subprocess.run(
        [shell, str(SCRIPT_PATH)],
        cwd=str(cwd),
        env=hook_env,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=15,
        check=False,
    )


def _calls(path: Path) -> list[list[str]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_read_hook_never_derives_git_space(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(bin_dir, "default briefing", calls=calls)
    project = tmp_path / "ExampleRepo"
    subdir = project / "subdir"
    subdir.mkdir(parents=True)
    subprocess.run(["git", "init", "-q"], cwd=str(project), check=True)

    result = _run_hook(
        tmp_path,
        cwd=subdir,
        env={"PATH": _cli_path(bin_dir), "NMEM_SPACE": ""},
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "default briefing", result.stderr
    assert _calls(calls) == [["--json", "context", "--source-app", "claude-code"]]


def test_read_hook_honors_nmem_space_override(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(bin_dir, "env briefing", calls=calls)

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": _cli_path(bin_dir), "NMEM_SPACE": "Research Lane"},
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "env briefing", result.stderr
    assert _calls(calls) == [
        [
            "--json",
            "context",
            "--source-app",
            "claude-code",
            "--space",
            "Research Lane",
        ]
    ]


def test_raw_context_is_utf8_even_with_a_windows_pipe_encoding(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    content = "briefing caf\u00e9 \u4e2d"
    _write_fake_nmem(bin_dir, content)
    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": _cli_path(bin_dir), "PYTHONIOENCODING": "cp1252"},
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == content, result.stderr


def test_read_hook_passes_agent_identity_env_to_context_bundle(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(bin_dir, "reviewer context", calls=calls)

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={
            "PATH": _cli_path(bin_dir),
            "NMEM_AGENT_ID": "reviewer",
            "NMEM_HOST_AGENT_ID": "lody:reviewer",
            "NMEM_SPACE": "",
        },
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "reviewer context", result.stderr
    assert _calls(calls) == [
        [
            "--json",
            "context",
            "--source-app",
            "claude-code",
            "--agent-id",
            "reviewer",
            "--host-agent-id",
            "lody:reviewer",
        ]
    ]


def _assert_grok_noop(tmp_path: Path, markers: dict[str, str]) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(bin_dir, "unused Grok context", calls=calls)
    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": _cli_path(bin_dir), **markers},
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == ""
    assert not calls.exists()


def test_read_hook_skips_grok_passive_context_output(tmp_path):
    _assert_grok_noop(
        tmp_path,
        {
            "GROK_SESSION_ID": "grok-session",
            "GROK_HOOK_EVENT": "SessionStart",
        },
    )


def test_read_hook_skips_grok_when_only_plugin_root_is_present(tmp_path):
    _assert_grok_noop(tmp_path, {"GROK_PLUGIN_ROOT": str(tmp_path / "plugin")})


def test_read_hook_skips_grok_for_claude_compat_plugin_root(tmp_path):
    _assert_grok_noop(
        tmp_path,
        {
            "CLAUDE_PLUGIN_ROOT": str(
                tmp_path
                / ".grok"
                / "installed-plugins"
                / "nowledge-mem-claude-code-plugin"
            ),
        },
    )


def test_read_hook_uses_default_space_without_an_explicit_override(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(bin_dir, "default briefing", calls=calls)
    project = tmp_path / "repo"
    project.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=str(project), check=True)

    result = _run_hook(
        tmp_path,
        cwd=project,
        env={"PATH": _cli_path(bin_dir), "NMEM_SPACE": ""},
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "default briefing", result.stderr
    assert all("--space" not in args for args in _calls(calls))


def test_read_hook_falls_back_to_working_memory_when_context_unavailable(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(bin_dir, "wm fallback", calls=calls, fail_context=True)

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": _cli_path(bin_dir), "NMEM_SPACE": ""},
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "wm fallback", result.stderr
    assert _calls(calls) == [
        ["--json", "context", "--source-app", "claude-code"],
        ["--json", "wm", "read"],
    ]


def test_read_hook_falls_back_to_local_memory_file_without_nmem(tmp_path):
    memory_file = tmp_path / "home" / "ai-now" / "memory.md"
    memory_file.parent.mkdir(parents=True)
    memory_file.write_text("file briefing\n", encoding="utf-8")
    bin_dir = tmp_path / "no-nmem-bin"
    bin_dir.mkdir()
    (bin_dir / "cat").symlink_to("/bin/cat")

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": str(bin_dir), "NMEM_SPACE": ""},
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "file briefing", result.stderr


def test_read_hook_invokes_windows_nmem_cmd_directly(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "cmd.log"

    if os.name == "nt":
        _write_fake_nmem(bin_dir, "cmd briefing", calls=calls)
    else:
        cli = _write_fake_nmem(bin_dir, "cmd briefing", calls=calls)
        cli.rename(bin_dir / "nmem.cmd")

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={
            "PATH": _cli_path(bin_dir),
            "NMEM_CLI_PATH": str(bin_dir / "nmem.cmd"),
            "NMEM_SPACE": 'project"2024',
        },
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "cmd briefing", result.stderr
    assert _calls(calls) == [
        [
            "--json",
            "context",
            "--source-app",
            "claude-code",
            "--space",
            'project"2024',
        ]
    ]
