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
        ["sh", str(SCRIPT_PATH)],
        cwd=str(cwd),
        env=hook_env,
        text=True,
        capture_output=True,
        timeout=15,
    )


def test_read_hook_prefers_git_common_dir_space(tmp_path):
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
    assert result.stdout.strip() == "space briefing"
    assert "--space examplerepo" in calls.read_text(encoding="utf-8")


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
    assert "--space Research Lane" in calls.read_text(encoding="utf-8")


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


def test_read_hook_falls_back_to_local_memory_file_without_nmem(tmp_path):
    memory_file = tmp_path / "home" / "ai-now" / "memory.md"
    memory_file.parent.mkdir(parents=True)
    memory_file.write_text("file briefing\n", encoding="utf-8")

    result = _run_hook(
        tmp_path,
        cwd=tmp_path,
        env={"PATH": "/bin:/usr/bin", "NMEM_SPACE": ""},
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "file briefing"
