import os
import subprocess
from pathlib import Path


SCRIPT_PATH = Path(__file__).parent.parent / "scripts" / "nmem-hook-read.sh"


def _write_fake_nmem(bin_dir: Path, body: str) -> Path:
    fake_nmem = bin_dir / "nmem"
    fake_nmem.write_text("#!/bin/sh\n" + body, encoding="utf-8")
    fake_nmem.chmod(0o755)
    return fake_nmem


def _run_hook(tmp_path: Path, *, cwd: Path, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    hook_env = os.environ.copy()
    hook_env.update(env)
    hook_env["HOME"] = str(tmp_path / "home")
    (Path(hook_env["HOME"]) / "ai-now").mkdir(parents=True, exist_ok=True)
    return subprocess.run(
        ["/bin/sh", str(SCRIPT_PATH)],
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


def test_read_hook_uses_grok_source_app_when_grok_env_is_present(tmp_path):
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
    assert result.stdout.strip() == "grok context"
    command_log = calls.read_text(encoding="utf-8")
    assert "context --source-app grok" in command_log


def test_read_hook_uses_grok_source_app_when_only_plugin_root_is_present(tmp_path):
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
    assert result.stdout.strip() == "grok plugin context"
    command_log = calls.read_text(encoding="utf-8")
    assert "context --source-app grok" in command_log


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


def test_read_hook_invokes_windows_nmem_cmd_by_command_name(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls = tmp_path / "cmd.log"

    nmem_cmd = bin_dir / "nmem.cmd"
    nmem_cmd.write_text("", encoding="utf-8")
    nmem_cmd.chmod(0o755)

    cmd_exe = bin_dir / "cmd.exe"
    cmd_exe.write_text(
        f"""#!/bin/sh
printf '%s\\n' "$*" > "{calls}"
case "$*" in
  *"nmem.cmd"*) printf '%s\\n' '{{"exists": true, "content": "cmd briefing"}}' ;;
  *) exit 1 ;;
esac
""",
        encoding="utf-8",
    )
    cmd_exe.chmod(0o755)

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": f"{bin_dir}:/bin:/usr/bin", "NMEM_SPACE": 'project"2024'},
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "cmd briefing"
    command = calls.read_text(encoding="utf-8")
    assert '"nmem.cmd" "--json" "context" "--source-app" "claude-code"' in command
    assert '"project\\"2024"' in command
