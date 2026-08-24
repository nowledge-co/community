import os
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_PATH = Path(__file__).parent.parent / "scripts" / "nmem-hook-read.sh"


def _shell_path(path: Path) -> str:
    value = path.as_posix()
    if os.name == "nt" and len(value) >= 3 and value[1:3] == ":/":
        return f"/{value[0].lower()}{value[2:]}"
    return value


def _write_fake_nmem(bin_dir: Path, body: str) -> Path:
    fake_nmem = bin_dir / "nmem"
    fake_nmem.write_text("#!/bin/sh\n" + body, encoding="utf-8")
    fake_nmem.chmod(0o755)
    return fake_nmem


def _run_hook(tmp_path: Path, *, cwd: Path, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    shell = shutil.which("sh")
    assert shell is not None, "sh is required to exercise the packaged hook"
    hook_env = os.environ.copy()
    for marker in (
        "GROK_SESSION_ID",
        "GROK_HOOK_EVENT",
        "GROK_WORKSPACE_ROOT",
        "GROK_PLUGIN_ROOT",
        "CLAUDE_PLUGIN_ROOT",
    ):
        hook_env.pop(marker, None)
    hook_env.update(env)
    hook_env["HOME"] = str(tmp_path / "home")
    (Path(hook_env["HOME"]) / "ai-now").mkdir(parents=True, exist_ok=True)
    return subprocess.run(
        [shell, str(SCRIPT_PATH)],
        cwd=str(cwd),
        env=hook_env,
        text=True,
        capture_output=True,
        timeout=15,
    )


def test_read_hook_never_derives_git_space(tmp_path):
    # Space is user-owned: inside a git repo but with no explicit $NMEM_SPACE,
    # the hook must NOT derive a repo-named space. It reads the default space
    # instead, and never passes `--space examplerepo`.
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(
        bin_dir,
        f"""
printf '%s\\n' "$*" >> "{calls}"
case "$*" in
  *"--space examplerepo"*) printf '%s\\n' '{{"exists": true, "content": "space briefing"}}' ;;
  *) printf '%s\\n' '{{"exists": true, "content": "default briefing"}}' ;;
esac
""",
    )
    project = tmp_path / "ExampleRepo"
    subdir = project / "subdir"
    subdir.mkdir(parents=True)
    subprocess.run(["git", "init", "-q"], cwd=str(project), check=True)

    result = _run_hook(
        tmp_path,
        cwd=subdir,
        env={"PATH": f"{bin_dir}:{os.environ['PATH']}", "NMEM_SPACE": ""},
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "default briefing"
    command_log = calls.read_text(encoding="utf-8")
    assert "--space examplerepo" not in command_log


def test_read_hook_honors_nmem_space_override(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(
        bin_dir,
        f"""
printf '%s\\n' "$*" >> "{calls}"
case "$*" in
  *"--space Research Lane"*) printf '%s\\n' '{{"exists": true, "content": "env briefing"}}' ;;
  *) printf '%s\\n' '{{"exists": true, "content": "default briefing"}}' ;;
esac
""",
    )

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": f"{bin_dir}:{os.environ['PATH']}", "NMEM_SPACE": "Research Lane"},
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "env briefing"
    command_log = calls.read_text(encoding="utf-8")
    assert "context --source-app claude-code --space Research Lane" in command_log


def test_read_hook_passes_agent_identity_env_to_context_bundle(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(
        bin_dir,
        f"""
printf '%s\\n' "$*" >> "{calls}"
case "$*" in
  *"--agent-id reviewer"*"--host-agent-id lody:reviewer"*) printf '%s\\n' '{{"rendered_markdown": "reviewer context"}}' ;;
  *) exit 2 ;;
esac
""",
    )

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={
            "PATH": f"{bin_dir}:{os.environ['PATH']}",
            "NMEM_AGENT_ID": "reviewer",
            "NMEM_HOST_AGENT_ID": "lody:reviewer",
            "NMEM_SPACE": "",
        },
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "reviewer context"
    command_log = calls.read_text(encoding="utf-8")
    assert "context --source-app claude-code --agent-id reviewer --host-agent-id lody:reviewer" in command_log


def test_read_hook_skips_grok_passive_context_output(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(
        bin_dir,
        f"""
printf '%s\\n' "$*" >> "{calls}"
case "$*" in
  *"--source-app grok"*) printf '%s\\n' '{{"rendered_markdown": "grok context"}}' ;;
  *) exit 2 ;;
esac
""",
    )

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={
            "PATH": f"{bin_dir}:{os.environ['PATH']}",
            "GROK_SESSION_ID": "grok-session",
            "GROK_HOOK_EVENT": "SessionStart",
            "NMEM_SPACE": "",
        },
    )

    assert result.returncode == 0
    assert result.stdout == ""
    assert not calls.exists()


def test_read_hook_skips_grok_when_only_plugin_root_is_present(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(
        bin_dir,
        f"""
printf '%s\\n' "$*" >> "{calls}"
case "$*" in
  *"--source-app grok"*) printf '%s\\n' '{{"rendered_markdown": "grok plugin context"}}' ;;
  *) exit 2 ;;
esac
""",
    )

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={
            "PATH": f"{bin_dir}:{os.environ['PATH']}",
            "GROK_PLUGIN_ROOT": str(tmp_path / "plugin"),
            "GROK_SESSION_ID": "",
            "GROK_HOOK_EVENT": "",
            "GROK_WORKSPACE_ROOT": "",
            "NMEM_SPACE": "",
        },
    )

    assert result.returncode == 0
    assert result.stdout == ""
    assert not calls.exists()


def test_read_hook_skips_grok_for_claude_compat_plugin_root(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(
        bin_dir,
        f"""
printf '%s\\n' "$*" >> "{calls}"
case "$*" in
  *"--source-app grok"*) printf '%s\\n' '{{"rendered_markdown": "grok compat context"}}' ;;
  *) exit 2 ;;
esac
""",
    )

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={
            "PATH": f"{bin_dir}:{os.environ['PATH']}",
            "CLAUDE_PLUGIN_ROOT": str(
                tmp_path / ".grok" / "installed-plugins" / "nowledge-mem-claude-code-plugin"
            ),
            "GROK_PLUGIN_ROOT": "",
            "GROK_SESSION_ID": "",
            "GROK_HOOK_EVENT": "",
            "GROK_WORKSPACE_ROOT": "",
            "NMEM_SPACE": "",
        },
    )

    assert result.returncode == 0
    assert result.stdout == ""
    assert not calls.exists()


def test_read_hook_falls_back_to_default_space_when_project_space_empty(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_fake_nmem(
        bin_dir,
        """
case "$*" in
  *"--space "*) printf '%s\\n' '{"exists": false, "content": ""}' ;;
  *) printf '%s\\n' '{"exists": true, "content": "default briefing"}' ;;
esac
""",
    )
    project = tmp_path / "repo"
    project.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=str(project), check=True)

    result = _run_hook(
        tmp_path,
        cwd=project,
        env={"PATH": f"{bin_dir}:{os.environ['PATH']}", "NMEM_SPACE": ""},
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "default briefing"


def test_read_hook_falls_back_to_working_memory_when_context_unavailable(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "calls.log"
    _write_fake_nmem(
        bin_dir,
        f"""
printf '%s\n' "$*" >> "{calls}"
case "$*" in
  *"context"*) exit 2 ;;
  *"wm read"*) printf '%s\n' '{{"exists": true, "content": "wm fallback"}}' ;;
  *) exit 1 ;;
esac
""",
    )

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": f"{bin_dir}:{os.environ['PATH']}", "NMEM_SPACE": ""},
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "wm fallback"
    command_log = calls.read_text(encoding="utf-8")
    assert "context --source-app claude-code" in command_log
    assert "wm read" in command_log


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

    assert result.returncode == 0
    assert result.stdout.strip() == "file briefing"


def test_read_hook_invokes_windows_nmem_cmd_directly(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "cmd.log"

    nmem_cmd = bin_dir / "nmem.cmd"
    if os.name == "nt":
        nmem_cmd.write_text(
            f'''@echo off
> "{calls}" echo %*
echo {{"exists": true, "content": "cmd briefing"}}
''',
            encoding="utf-8",
        )
    else:
        nmem_cmd.write_text(
            f'''#!/bin/sh
printf '%s\\n' "$*" > "{calls}"
printf '%s\\n' '{{"exists": true, "content": "cmd briefing"}}'
''',
            encoding="utf-8",
        )
    nmem_cmd.chmod(0o755)

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={
            "PATH": (
                f"{_shell_path(bin_dir)}:"
                f"{_shell_path(Path(sys.executable).parent)}:/bin:/usr/bin"
            ),
            "NMEM_SPACE": 'project"2024',
        },
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "cmd briefing"
    command = calls.read_text(encoding="utf-8")
    assert "--json context --source-app claude-code" in command
    assert "project" in command and "2024" in command
