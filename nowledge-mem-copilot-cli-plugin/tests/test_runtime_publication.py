"""Real filesystem/process regression guards for optional runtime publication."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

INSTALLER = Path(__file__).resolve().parents[1] / 'scripts' / 'install_hooks.py'
spec = importlib.util.spec_from_file_location('copilot_installer', INSTALLER)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


@pytest.fixture
def runtime(tmp_path):
    source, profile = tmp_path / 'source', tmp_path / 'profile'
    hook = profile / 'nowledge-mem-hooks'
    source.mkdir()
    (hook / 'state').mkdir(parents=True)
    (hook / 'state' / 'retained').write_text('capture state')
    for name in publisher.FILES:
        (source / name).write_text('new ' + name)
        (hook / name).write_text('old ' + name)
    return source, profile, hook


def generation(hook, expected):
    for name in publisher.FILES:
        assert (hook / name).read_text() == expected + ' ' + name
    assert (hook / 'state' / 'retained').read_text() == 'capture state'


@pytest.mark.parametrize('boundary', ['staged', 'before-publish', 'published-file', 'before-commit'])
def test_publication_fault_restores_entire_previous_runtime(runtime, boundary):
    source, profile, hook = runtime
    def fail(observed):
        if observed == boundary:
            raise OSError('injected publication fault')
    with pytest.raises(RuntimeError, match='previous runtime retained'):
        publisher.publish(source, profile, fail)
    generation(hook, 'old')
    assert not (profile / publisher.TRANSACTION).exists()


def test_staging_source_io_failure_preserves_all_live_files(runtime):
    source, profile, hook = runtime
    invalid = source / publisher.FILES[1]
    invalid.unlink()
    invalid.mkdir()
    with pytest.raises(RuntimeError, match='previous runtime retained'):
        publisher.publish(source, profile)
    generation(hook, 'old')
    assert not (profile / publisher.TRANSACTION).exists()


def test_original_absence_is_restored(runtime):
    source, profile, hook = runtime
    absent = hook / publisher.FILES[0]
    absent.unlink()
    def fail(observed):
        if observed == 'published-file':
            raise OSError('stop after originally absent file')
    with pytest.raises(RuntimeError):
        publisher.publish(source, profile, fail)
    assert not absent.exists()
    for name in publisher.FILES[1:]:
        assert (hook / name).read_text() == 'old ' + name


@pytest.mark.parametrize('boundary,expected', [('published-file', 'old'), ('before-cleanup', 'new')])
def test_process_exit_recovers_before_source_validation(runtime, boundary, expected):
    source, profile, hook = runtime
    code = (
        "import importlib.util,os,pathlib,sys; "
        "s=importlib.util.spec_from_file_location('publisher',sys.argv[1]); "
        "m=importlib.util.module_from_spec(s);s.loader.exec_module(m); "
        "m.publish(pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3]),"
        "lambda p:os._exit(42) if p==sys.argv[4] else None)"
    )
    child = subprocess.run([sys.executable, '-c', code, str(INSTALLER), str(source), str(profile), boundary],
                           capture_output=True, text=True)
    assert child.returncode == 42, child.stderr
    assert (profile / publisher.TRANSACTION).exists()
    with pytest.raises(RuntimeError, match='previous runtime retained'):
        publisher.publish(profile / 'missing-source', profile)
    generation(hook, expected)
    assert not (profile / publisher.TRANSACTION).exists()
    assert not (profile / publisher.TRANSACTION).with_suffix('.committed').exists()


def test_recovery_failure_retains_journal_then_retry_restores_remaining_files(runtime):
    source, profile, hook = runtime
    obstacle = hook / publisher.FILES[1]
    def fail(observed):
        if observed == 'before-commit':
            obstacle.unlink()
            obstacle.mkdir()
            raise OSError('failed after live publication')
    with pytest.raises(RuntimeError, match='Recovery is incomplete'):
        publisher.publish(source, profile, fail)
    txn = profile / publisher.TRANSACTION
    assert (txn / 'journal.json').exists()
    assert (txn / 'old' / publisher.FILES[1]).exists()
    assert (hook / publisher.FILES[0]).read_text() == 'old ' + publisher.FILES[0]
    obstacle.rmdir()
    with pytest.raises(RuntimeError):
        publisher.publish(profile / 'missing-source', profile)
    generation(hook, 'old')
    assert not txn.exists()


@pytest.mark.parametrize('entries', [[], [['../state', True]], [['copilot-hook.py', 1]],
    [['copilot-hook.py', 'true']], [['copilot-hook.py', True], ['copilot-hook.py', False]],
    {'copilot-hook.py': True}])
def test_invalid_journal_is_retained_without_live_changes(runtime, entries):
    source, profile, hook = runtime
    txn = profile / publisher.TRANSACTION
    txn.mkdir()
    (txn / 'journal.json').write_text(json.dumps(entries))
    with pytest.raises(RuntimeError, match='recovery is incomplete'):
        publisher.publish(source, profile)
    generation(hook, 'old')
    assert (txn / 'journal.json').exists()


def test_oversized_journal_is_retained(runtime):
    source, profile, hook = runtime
    txn = profile / publisher.TRANSACTION
    txn.mkdir()
    (txn / 'journal.json').write_bytes(b' ' * (publisher.JOURNAL_LIMIT + 1))
    with pytest.raises(RuntimeError, match='size limit'):
        publisher.publish(source, profile)
    generation(hook, 'old')


def test_competing_owner_cannot_publish_then_release_allows_retry(runtime):
    source, profile, hook = runtime
    with publisher.ownership(profile):
        with pytest.raises(OSError):
            publisher.publish(source, profile)
        generation(hook, 'old')
    publisher.publish(source, profile)
    generation(hook, 'new')
