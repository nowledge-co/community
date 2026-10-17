"""Exercise profile selection through the shipped Python processes and hook commands."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
CAPTURE = PLUGIN / 'hooks' / 'copilot-stop-save.py'


def isolated_env(tmp_path):
    home = tmp_path / 'user'
    home.mkdir()
    env = dict(os.environ, HOME=str(home), USERPROFILE=str(home))
    for name in ('COPILOT_HOME', 'COPILOT_PLUGIN_ROOT', 'PLUGIN_ROOT', 'CLAUDE_PLUGIN_ROOT'):
        env.pop(name, None)
    return env, home


@pytest.mark.parametrize('override', [None, 'profile with spaces', './literal $HOME ~ $(never-run)', 'absolute'])
def test_capture_state_and_log_follow_active_profile(tmp_path, override):
    env, home = isolated_env(tmp_path)
    if override is None:
        profile = home / '.copilot'
    else:
        env['COPILOT_HOME'] = str(tmp_path / 'absolute') if override == 'absolute' else override
        profile = Path(env['COPILOT_HOME'])
        if not profile.is_absolute():
            profile = tmp_path / profile
    script = (
        "import runpy,sys; m=runpy.run_path(sys.argv[1]); "
        "m['log']({'probe':'profile'}); "
        "p,s=m['load_state']('owned-session'); m['save_state'](p,{'probe':'state'}); "
        "print(p)"
    )
    result = subprocess.run([sys.executable, '-c', script, str(CAPTURE)], env=env,
                            cwd=tmp_path, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    root = profile / 'nowledge-mem-hooks'
    assert json.loads((root / 'hook-log.jsonl').read_text()) == {'probe': 'profile'}
    state_path = Path(result.stdout.strip())
    assert state_path.parent == root / 'state'
    assert json.loads(state_path.read_text()) == {'probe': 'state'}
    if override is not None:
        assert not (home / '.copilot').exists()


def test_empty_profile_rejects_before_default_profile_writes(tmp_path):
    env, home = isolated_env(tmp_path)
    env['COPILOT_HOME'] = ''
    result = subprocess.run([sys.executable, str(CAPTURE)], input='{}', env=env,
                            cwd=tmp_path, capture_output=True, text=True)
    assert result.returncode != 0
    assert 'COPILOT_HOME' in result.stderr
    assert not (home / '.copilot').exists()


def hook_commands():
    hooks = json.loads((PLUGIN / 'hooks' / 'hooks.json').read_text())['hooks']
    return [entry['command'] for groups in hooks.values()
            for group in groups for entry in group['hooks']]


@pytest.mark.parametrize('command', hook_commands())
def test_compatibility_bootstrap_uses_active_profile(tmp_path, command):
    env, home = isolated_env(tmp_path)
    env['COPILOT_HOME'] = './profile $HOME with spaces'
    runtime = tmp_path / env['COPILOT_HOME'] / 'nowledge-mem-hooks'
    runtime.mkdir(parents=True)
    (runtime / 'copilot-hook.py').write_text("print('selected-profile-runtime')\n")
    argv = shlex.split(command)
    argv[0] = sys.executable
    result = subprocess.run(argv, env=env, cwd=tmp_path, input='{}',
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == 'selected-profile-runtime'
    assert not (home / '.copilot').exists()


def copied_installer(tmp_path):
    import shutil
    package = tmp_path / 'package'
    shutil.copytree(PLUGIN, package, ignore=shutil.ignore_patterns('__pycache__', '.pytest_cache'))
    return package


def run_installer(package, env, cwd):
    import shutil
    bash = shutil.which('bash')
    if bash is None:
        pytest.skip('compatibility shell wrapper requires bash; Python publisher is tested separately')
    return subprocess.run([bash, str(package / 'scripts' / 'install-hooks.sh')],
                          env=env, cwd=cwd, capture_output=True, text=True)


def test_compatibility_install_contains_current_entry_point_and_retains_state(tmp_path):
    env, home = isolated_env(tmp_path)
    package = copied_installer(tmp_path)
    runtime = home / '.copilot' / 'nowledge-mem-hooks'
    (runtime / 'state').mkdir(parents=True)
    state = runtime / 'state' / 'existing.json'
    state.write_text('existing capture state')
    result = run_installer(package, env, tmp_path)
    assert result.returncode == 0, result.stderr
    for name in ('copilot-stop-save.py', 'copilot-stop-save.sh', 'copilot-hook.py'):
        assert (runtime / name).read_bytes() == (package / 'hooks' / name).read_bytes()
    assert state.read_text() == 'existing capture state'


def test_late_source_failure_preserves_complete_previous_runtime(tmp_path):
    env, home = isolated_env(tmp_path)
    package = copied_installer(tmp_path)
    runtime = home / '.copilot' / 'nowledge-mem-hooks'
    runtime.mkdir(parents=True)
    names = ('copilot-stop-save.py', 'copilot-stop-save.sh', 'copilot-hook.py')
    for name in names:
        (runtime / name).write_text('previous ' + name)
    source = package / 'hooks' / names[1]
    if hasattr(os, 'geteuid') and os.geteuid() == 0:
        pytest.skip('root can read the deliberately unreadable source')
    source.chmod(0)
    result = run_installer(package, env, tmp_path)
    assert result.returncode != 0
    for name in names:
        assert (runtime / name).read_text() == 'previous ' + name


def test_compatibility_installer_honors_literal_relative_profile(tmp_path):
    env, home = isolated_env(tmp_path)
    env['COPILOT_HOME'] = './profile $HOME ~ with spaces'
    package = copied_installer(tmp_path)
    result = run_installer(package, env, tmp_path)
    assert result.returncode == 0, result.stderr
    runtime = tmp_path / env['COPILOT_HOME'] / 'nowledge-mem-hooks'
    assert (runtime / 'copilot-hook.py').read_bytes() == (package / 'hooks' / 'copilot-hook.py').read_bytes()
    assert not (home / '.copilot').exists()


def test_shell_installer_fails_before_writes_when_python_is_unavailable(tmp_path):
    env, home = isolated_env(tmp_path)
    package = copied_installer(tmp_path)
    env['PATH'] = str(tmp_path / 'empty-bin')
    result = run_installer(package, env, tmp_path)
    assert result.returncode != 0
    assert not (home / '.copilot').exists()


@pytest.mark.skipif(os.name == 'nt', reason='shell wrapper symlink invocation is a POSIX compatibility path')
def test_shell_installer_resolves_its_symlink_before_locating_python_script(tmp_path):
    import shutil
    env, home = isolated_env(tmp_path)
    package = copied_installer(tmp_path)
    link = tmp_path / 'installer-link'
    link.symlink_to(package / 'scripts' / 'install-hooks.sh')
    bash = shutil.which('bash')
    if bash is None:
        pytest.skip('bash is unavailable')
    result = subprocess.run([bash, str(link)], env=env, cwd=tmp_path, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert (home / '.copilot' / 'nowledge-mem-hooks' / 'copilot-hook.py').exists()


@pytest.mark.skipif(os.name == 'nt', reason='POSIX directory symlink traversal guard')
@pytest.mark.parametrize('absolute', [False, True])
@pytest.mark.parametrize('surface', ['capture', 'installer', 'bootstrap'])
def test_symlink_parent_components_select_the_same_physical_profile(tmp_path, absolute, surface):
    env, home = isolated_env(tmp_path)
    target = tmp_path / 'physical' / 'nested'
    target.mkdir(parents=True)
    (tmp_path / 'linked').symlink_to(target, target_is_directory=True)
    value = 'linked/../selected'
    env['COPILOT_HOME'] = str(tmp_path / value) if absolute else value
    runtime = tmp_path / 'physical' / 'selected' / 'nowledge-mem-hooks'
    if surface == 'capture':
        result = subprocess.run([sys.executable, '-c',
            "import runpy,sys;m=runpy.run_path(sys.argv[1]);m['log']({'selected':True})", str(CAPTURE)],
            env=env, cwd=tmp_path, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        assert json.loads((runtime / 'hook-log.jsonl').read_text()) == {'selected': True}
    elif surface == 'installer':
        result = run_installer(copied_installer(tmp_path), env, tmp_path)
        assert result.returncode == 0, result.stderr
        assert (runtime / 'copilot-hook.py').exists()
    else:
        runtime.mkdir(parents=True)
        (runtime / 'copilot-hook.py').write_text("print('physical-profile')\n")
        for command in hook_commands():
            argv = shlex.split(command)
            argv[0] = sys.executable
            result = subprocess.run(argv, input='{}', env=env, cwd=tmp_path, capture_output=True, text=True)
            assert result.returncode == 0, result.stderr
            assert result.stdout.strip() == 'physical-profile'
    assert not (tmp_path / 'selected').exists()
    assert not (home / '.copilot').exists()
