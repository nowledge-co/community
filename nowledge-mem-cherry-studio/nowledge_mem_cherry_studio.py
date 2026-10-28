"""Local, opt-in source observation. nmem owns parsing, auth and persistence."""

import argparse
import contextlib
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time

VERSION = "0.1.0"
UNBOUND_PROFILE = object()


class SyncError(Exception):
    """Only static, non-sensitive messages leave this boundary."""


def local_database(raw):
    if not raw or raw.startswith(("//", "\\\\")):
        raise argparse.ArgumentTypeError("Choose a local Cherry Studio database file")
    path = Path(raw).expanduser().resolve()
    if not path.is_file():
        raise argparse.ArgumentTypeError("The selected database file does not exist")
    return path


def bounded_seconds(raw):
    value = float(raw)
    if not math.isfinite(value) or not 5 <= value <= 3600:
        raise argparse.ArgumentTypeError("Use between 5 and 3600 seconds")
    return value


def fingerprint(database):
    # WAL changes matter even when SQLite never touches the main file's mtime.
    values = []
    for index, path in enumerate((database, Path(str(database) + "-wal"))):
        try:
            stat = path.stat()
            # A read-only SQLite connection may create an empty WAL sidecar.
            # Header-only files contain no transaction pages and are not a
            # source edit; do not misdiagnose our own metadata inspection.
            values.append(None if index == 1 and stat.st_size <= 32 else
                          (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns))
        except FileNotFoundError:
            values.append(None)
    return tuple(values)


def config_directory():
    # Match native nmem's override > HOME > USERPROFILE resolution exactly.
    explicit = os.environ.get("NMEM_CLI_CONFIG_DIR")
    if explicit:
        return Path(explicit).resolve()
    home = os.environ.get("HOME", os.environ.get("USERPROFILE"))
    if home is None:
        raise SyncError("Cannot resolve the native CLI configuration directory")
    return (Path(home) / ".nowledge-mem").resolve()


def profile_stamp():
    path = config_directory() / "config.json"
    try:
        stat = path.stat()
        return stat.st_ino, stat.st_size, stat.st_mtime_ns
    except FileNotFoundError:
        return None


@contextlib.contextmanager
def pinned_profile(expected=UNBOUND_PROFILE):
    # Snapshot the native config opaquely, without parsing credentials or
    # duplicating native auth/Space resolution. Both children read this private
    # immutable copy, never a mutable profile between preview and apply.
    before = profile_stamp()
    if expected is not UNBOUND_PROFILE and before != expected:
        raise SyncError("nmem profile changed before binding the destination; stop and restart after reviewing it")
    try:
        with tempfile.TemporaryDirectory(prefix="cherry-nmem-") as directory:
            source = config_directory() / "config.json"
            try:
                with source.open("rb") as stream:
                    data = stream.read(1024 * 1024 + 1)
            except FileNotFoundError:
                data = None
            if data is not None:
                if len(data) > 1024 * 1024:
                    raise SyncError("CLI configuration exceeds the snapshot limit")
                target = Path(directory) / "config.json"
                with target.open("xb") as stream:
                    os.chmod(target, 0o600)
                    stream.write(data)
            if profile_stamp() != before:
                raise SyncError("nmem profile changed while binding the destination; retry after reviewing it")
            env = dict(os.environ, NMEM_CLI_CONFIG_DIR=directory)
            yield env
    except OSError:
        raise SyncError("Cannot bind the native CLI profile safely") from None


def required_topics(database):
    """Metadata-only compatibility gate; never duplicate transcript parsing."""
    try:
        conn = sqlite3.connect(database.as_uri() + "?mode=ro", uri=True, timeout=2)
        try:
            conn.execute("PRAGMA query_only=ON")
            if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='topic'").fetchone():
                return set()
            rows = conn.execute(
                "SELECT t.id FROM topic t WHERE t.deleted_at IS NULL AND t.active_node_id IS NOT NULL "
                "AND EXISTS(SELECT 1 FROM message m WHERE m.topic_id=t.id AND m.deleted_at IS NULL "
                "AND m.status='success' AND m.role='user') "
                "AND EXISTS(SELECT 1 FROM message m WHERE m.topic_id=t.id AND m.deleted_at IS NULL "
                "AND m.status='success' AND m.role='assistant') LIMIT 10001"
            ).fetchall()
            if len(rows) > 10000:
                raise SyncError("Topic inventory exceeds the compatibility inspection limit")
            return {"topic:" + row[0] for row in rows}
        finally:
            conn.close()
    except sqlite3.Error:
        raise SyncError("Cannot inspect Cherry Studio metadata; check version and database availability") from None


def forbidden_agent_sessions(database):
    """Reject older readers that still include trash/internal Agent sessions."""
    try:
        conn = sqlite3.connect(database.as_uri() + "?mode=ro", uri=True, timeout=2)
        try:
            conn.execute("PRAGMA query_only=ON")
            columns = {row[1] for row in conn.execute("PRAGMA table_info(agent_session)")}
            clauses = []
            if "deleted_at" in columns:
                clauses.append("deleted_at IS NOT NULL")
            if "type" in columns:
                clauses.append("type IS NULL OR type <> 'conversation'")
            if not clauses:
                return set()
            rows = conn.execute("SELECT id FROM agent_session WHERE " + " OR ".join(clauses) + " LIMIT 10001").fetchall()
            if len(rows) > 10000:
                raise SyncError("Agent visibility inventory exceeds the compatibility inspection limit")
            return {row[0] for row in rows}
        finally:
            conn.close()
    except sqlite3.Error:
        raise SyncError("Cannot inspect Cherry Studio session visibility") from None


def invoke(command, timeout, env=None):
    # Redirect to private temporary files instead of unbounded captured pipes.
    # No transcript or CLI error body is printed or retained after the call.
    try:
        with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            result = subprocess.run(command, stdout=out, stderr=err, timeout=timeout, check=False, env=env)
            out.seek(0, 2)
            if out.tell() > 8 * 1024 * 1024:
                raise SyncError("CLI receipt exceeded the inspection limit")
            out.seek(0)
            if result.returncode != 0:
                raise SyncError("nmem failed; no source progress was acknowledged")
            value = json.load(out)
    except subprocess.TimeoutExpired:
        raise SyncError("nmem timed out; the next observation will safely reconcile again") from None
    except (OSError, ValueError):
        raise SyncError("nmem did not return a valid JSON receipt") from None
    if not isinstance(value, dict) or value.get("status") != "success" or type(value.get("failed")) is not int or value["failed"] != 0:
        raise SyncError("nmem reported an incomplete synchronization; progress was not acknowledged")
    rows = value.get("results")
    if not isinstance(rows, list) or not all(isinstance(row, dict) and isinstance(row.get("session_id"), str) for row in rows):
        raise SyncError("nmem returned an unsupported receipt shape")
    return value


def sync_once(args, expected_profile=UNBOUND_PROFILE):
    with pinned_profile(expected_profile) as env:
        return sync_bound(args, env)


def sync_bound(args, env):
    profile = profile_stamp()
    command = [args.nmem, "--json", "t", "sync", "--from", "cherrystudio",
               "--all-projects", "--session-dir", str(args.database)]
    if args.space_id is not None:
        command += ["--space-id", args.space_id]
    source_stamp = fingerprint(args.database)
    expected = required_topics(args.database)
    forbidden = forbidden_agent_sessions(args.database)
    preview = invoke(command, args.timeout, env)
    actual = {row.get("session_id") for row in preview["results"]}
    if (actual & forbidden or not expected.issubset(actual)) and fingerprint(args.database) != source_stamp:
        raise SyncError("Cherry Studio changed while checking reader compatibility; retry after the current turn completes")
    if actual & forbidden:
        raise SyncError("This nmem reader includes trash or internal Agent sessions; update nmem before enabling sync")
    if not expected.issubset(actual):
        raise SyncError("This nmem reader does not cover ordinary Cherry chats; update nmem before enabling sync")
    if not args.apply:
        return {"status": "preview", "sessions": len(preview["results"]), "uploaded": False}
    if profile_stamp() != profile:
        raise SyncError("nmem profile changed during preview; restart after reviewing the destination")
    receipt = invoke(command + ["--apply"], args.timeout, env)
    if receipt.get("apply") is not True or any(
        row.get("action") not in {"created", "appended", "reconciled", "unchanged"}
        and not (row.get("action") == "skipped" and row.get("conversation_empty") is True and row.get("partial_record") is not True)
        for row in receipt["results"]
    ) or not actual.issubset({row["session_id"] for row in receipt["results"]}):
        raise SyncError("nmem did not acknowledge an applied synchronization")
    return {"status": "synced", "sessions": len(receipt["results"]),
            "created": receipt.get("created", 0), "appended": receipt.get("appended", 0)}


@contextlib.contextmanager
def single_owner(args):
    # No persistent cursor, API key, message body or source path in this file.
    identity = json.dumps([str(args.database), str(config_directory()), args.space_id, os.environ.get("NMEM_API_URL"),
                           os.environ.get("NMEM_API_KEY"), os.environ.get("NMEM_SPACE")])
    digest = hashlib.sha256(identity.encode()).hexdigest()
    root = config_directory() / "cherry-studio"
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root / (digest + ".lock")).open("a+b") as lock:
        try:
            if os.name == "nt":
                import msvcrt
                lock.seek(0)
                if not lock.read(1):
                    lock.write(b"0")
                    lock.flush()
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise SyncError("Another companion already owns this database and destination") from None
        yield


def run(args, *, sleep=time.sleep, clock=time.monotonic):
    acknowledged = None
    last_success = float("-inf")
    initial_profile = profile_stamp()
    while True:
        try:
            if profile_stamp() != initial_profile:
                raise SyncError("nmem profile changed; stop and restart after reviewing the destination")
            observed = fingerprint(args.database)
            # Periodic full reconciliation also handles target/profile changes,
            # remote deletion and lost acknowledgements; there is no skip cursor.
            if observed != acknowledged or clock() - last_success >= args.reconcile_interval:
                report = sync_once(args, expected_profile=initial_profile)
                print(json.dumps(report), flush=True)
                acknowledged = observed  # BEFORE the call, not a racing newer WAL.
                last_success = clock()
        except (SyncError, OSError) as error:
            detail = str(error) if isinstance(error, SyncError) else "Cannot observe the selected database"
            print(json.dumps({"status": "retrying" if args.watch else "failed", "detail": detail}), flush=True)
            if not args.watch:
                return 1
        if not args.watch:
            return 0
        sleep(args.interval)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", action="version", version=VERSION)
    parser.add_argument("--database", required=True, type=local_database)
    parser.add_argument("--nmem", default="nmem", help="Installed native nmem executable; no auto-download")
    parser.add_argument("--space-id", help="Exact destination Space ID, passed unchanged to nmem")
    parser.add_argument("--apply", action="store_true", help="Consent to import existing and future conversations")
    parser.add_argument("--watch", action="store_true", help="Run in the foreground until Ctrl-C (requires --apply)")
    parser.add_argument("--interval", type=bounded_seconds, default=15.0)
    parser.add_argument("--reconcile-interval", type=bounded_seconds, default=300.0)
    parser.add_argument("--timeout", type=bounded_seconds, default=120.0)
    args = parser.parse_args(argv)
    if args.watch and not args.apply:
        parser.error("--watch requires explicit --apply; preview without --watch first")
    resolved = shutil.which(args.nmem)
    if not resolved:
        parser.error("Install and configure nmem on the Cherry Studio machine first")
    args.nmem = resolved
    try:
        if not args.watch:
            return run(args)
        with single_owner(args):
            return run(args)
    except KeyboardInterrupt:
        return 0
    except (SyncError, OSError):
        print(json.dumps({"status": "failed", "detail": "Cannot acquire the companion owner lock"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
