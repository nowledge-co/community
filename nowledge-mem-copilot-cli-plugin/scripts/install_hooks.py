#!/usr/bin/env python3
"""Publish the optional compatibility runtime without moving capture state.

The lock, recovery journal and commit marker match the Desktop publisher.
Recovery covers process interruption; this is not a multi-file reader snapshot
or a guarantee against power loss.
"""
from __future__ import annotations

from contextlib import contextmanager
import json
import os
from pathlib import Path
import shutil
import stat
import sys

FILES = ('copilot-stop-save.py', 'copilot-stop-save.sh', 'copilot-hook.py')
TRANSACTION = '.nowledge-mem-hooks.transaction'
LOCK = '.nowledge-mem-hooks.publish.lock'
JOURNAL_LIMIT = 64 * 1024


def effective_profile() -> Path:
    value = os.environ.get('COPILOT_HOME')
    if value == '':
        raise ValueError('COPILOT_HOME must not be empty')
    if value is None:
        return Path.home() / '.copilot'
    path = Path(value)
    if not path.is_absolute():
        if path.root or path.drive:
            raise ValueError('COPILOT_HOME must identify a complete directory path')
        # Keep .. components: filesystem traversal through symlinks must agree
        # with Copilot and the Desktop profile owner.
        path = Path.cwd() / path
    return path


def regular(path: Path) -> bool:
    try:
        mode = path.lstat().st_mode
    except FileNotFoundError:
        return False
    if not stat.S_ISREG(mode):
        raise OSError(f'Expected regular runtime file: {path}')
    return True


@contextmanager
def ownership(profile: Path):
    profile.mkdir(parents=True, exist_ok=True)
    # Never unlink the ownership file: every publisher must lock the same inode.
    with (profile / LOCK).open('a+b') as handle:
        handle.seek(0)
        if sys.platform == 'win32':
            import msvcrt
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            # Explicit release also ends ownership if a fork retains a descriptor.
            handle.seek(0)
            if sys.platform == 'win32':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def read_journal(txn: Path):
    path = txn / 'journal.json'
    if not regular(path):
        return None
    with path.open('rb') as handle:
        raw = handle.read(JOURNAL_LIMIT + 1)
    if len(raw) > JOURNAL_LIMIT:
        raise ValueError('Runtime recovery journal exceeds size limit')
    entries = json.loads(raw)
    if not isinstance(entries, list) or not 1 <= len(entries) <= len(FILES):
        raise ValueError('Invalid runtime recovery journal')
    seen = set()
    for entry in entries:
        if (not isinstance(entry, list) or len(entry) != 2
                or not isinstance(entry[0], str) or entry[0] not in FILES
                or entry[0] in seen or type(entry[1]) is not bool):
            raise ValueError('Invalid runtime recovery journal')
        seen.add(entry[0])
    return entries


def recover(profile: Path):
    txn = profile / TRANSACTION
    committed = txn.with_suffix('.committed')
    try:
        mode = txn.lstat().st_mode
    except FileNotFoundError:
        if regular(committed):
            committed.unlink()
        return
    if not stat.S_ISDIR(mode):
        raise OSError('Runtime transaction is not a directory')
    entries = read_journal(txn)
    if entries is not None and not regular(committed):
        hook = profile / 'nowledge-mem-hooks'
        for name, existed in entries:
            live, backup = hook / name, txn / 'old' / name
            if existed:
                if regular(backup):
                    regular(live)  # reject directories/symlinks; absence is allowed
                    os.replace(backup, live)
            elif regular(live):
                live.unlink()
    shutil.rmtree(txn)
    if regular(committed):
        committed.unlink()


def recover_owned(profile: Path):
    try:
        recover(profile)
    except (OSError, ValueError) as error:
        raise RuntimeError(
            f'Copilot runtime recovery is incomplete; retained {profile / TRANSACTION} for retry: {error}'
        ) from error


def publish(source: Path, profile: Path, fault=lambda _boundary: None) -> Path:
    """Fault callback exercises real IO boundaries in regression tests."""
    with ownership(profile):
        recover_owned(profile)
        hook, txn = profile / 'nowledge-mem-hooks', profile / TRANSACTION
        (hook / 'state').mkdir(parents=True, exist_ok=True)
        try:
            txn.mkdir()
            (txn / 'new').mkdir()
            (txn / 'old').mkdir()
            entries = []
            for name in FILES:
                staged = txn / 'new' / name
                shutil.copyfile(source / name, staged)
                if os.name != 'nt':
                    staged.chmod(0o755)
                entries.append([name, regular(hook / name)])
            fault('staged')
            with (txn / 'journal.pending').open('w', encoding='utf-8') as handle:
                json.dump(entries, handle)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(txn / 'journal.pending', txn / 'journal.json')
            for name, existed in entries:
                if existed:
                    os.replace(hook / name, txn / 'old' / name)
                fault('before-publish')
                os.replace(txn / 'new' / name, hook / name)
                fault('published-file')
            fault('before-commit')
            txn.with_suffix('.committed').touch()
        except (OSError, ValueError) as error:
            try:
                fault('before-recovery')
                recover_owned(profile)
            except (OSError, ValueError, RuntimeError) as recovery:
                raise RuntimeError(
                    f'Copilot runtime publication failed: {error}. Recovery is incomplete; '
                    f'retained {txn} for retry: {recovery}'
                ) from error
            raise RuntimeError(f'Copilot runtime publication failed; previous runtime retained: {error}') from error
        try:
            fault('before-cleanup')
            recover_owned(profile)
        except (OSError, ValueError, RuntimeError) as error:
            raise RuntimeError(f'Runtime published, but cleanup is incomplete at {txn}: {error}') from error
        return hook


def main() -> int:
    try:
        runtime = publish(Path(__file__).resolve().parents[1] / 'hooks', effective_profile())
    except (OSError, ValueError, RuntimeError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        return 1
    print(f'Compatibility hooks installed to {runtime}. Restart Copilot CLI to reload hooks.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
