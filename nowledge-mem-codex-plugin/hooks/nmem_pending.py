#!/usr/bin/env python3
"""Private host-local pending control; owner CLI keeps authoritative effects.

This SQLite file is outside Mem app data, ContentStore, knowledge backups and
the CLI's enrollment journal. It contains only bounded control references and
model-approved public maintenance fields, never Rules, mail or owner receipts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import stat
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

SCHEMA_VERSION = 1
MAX_CONTROL_BYTES = 64 * 1024
MAX_STORE_PAGES = 1024  # 4 MiB at the fixed 4096-byte page size; never prune intent.
MAX_HINT_BYTES = 2 * 1024
TOKEN_RE = re.compile(r"[A-Za-z0-9_.:-]{1,120}")
ID_RE = re.compile(r"[0-9a-f]{64}")
INTENT_DIGEST_RE = re.compile(r"sha256:[0-9a-f]{64}")
TERMINAL_STATES = frozenset({"declined", "completed", "desired_current", "recovered_selection"})
STATES = TERMINAL_STATES | {"pending", "confirmed", "prepared", "unknown", "conflict"}
ITEM_KEYS = {"version", "item_id", "event_id", "context_name", "space_id", "state",
             "confirmed_kind", "operation", "context_reference", "profile"}


def _bounded(value: Any, maximum: int, *, nonempty: bool = False) -> str | None:
    if not isinstance(value, str) or "\0" in value or (nonempty and not value):
        return None
    try:
        return value if len(value.encode("utf-8")) <= maximum else None
    except UnicodeError:
        return None


def _token(value: Any) -> str | None:
    return value if isinstance(value, str) and TOKEN_RE.fullmatch(value) else None


def _encode(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    if len(raw.encode("utf-8")) > MAX_CONTROL_BYTES:
        raise ValueError("pending control too large")
    return raw


def _digest(value: Any) -> str:
    return hashlib.sha256(_encode(value).encode("utf-8")).hexdigest()


def _root() -> Path:
    configured = os.environ.get("CODEX_HOME", "").strip()
    home = (Path(configured).expanduser() if configured else Path.home() / ".codex").resolve()
    return home / "state" / "nowledge-mem" / "pending-maintenance"


def _private_directory(path: Path) -> None:
    # Only our owned suffix is created/checked. Never chmod the host profile.
    for directory in (path.parent.parent, path.parent, path):
        directory.mkdir(mode=0o700, exist_ok=True)
        info = directory.lstat()
        if not stat.S_ISDIR(info.st_mode):
            raise OSError("pending directory is not an ordinary directory")
        if directory != path.parent.parent and os.name != "nt" and info.st_mode & 0o077:
            raise OSError("pending directory is not private")


def _private_file(path: Path, *, create: bool) -> None:
    if create:
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            pass
        else:
            os.close(fd)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        raise OSError("pending file is not an ordinary private file")
    if os.name != "nt" and info.st_mode & 0o077:
        raise OSError("pending file is not private")
    if path.name == "control.sqlite3" and info.st_size > MAX_STORE_PAGES * 4096:
        raise OSError("pending store exceeds its physical bound")


@contextmanager
def _store(*, create: bool = False):
    root = _root()
    database = root / "control.sqlite3"
    if create:
        _private_directory(root)
        _private_file(database, create=True)
    else:
        # No store is an ordinary state. Do not create files on startup reads.
        _private_file(database, create=False)
        _private_directory(root)
    connection = sqlite3.connect(database, timeout=0, isolation_level=None)
    try:
        connection.execute("PRAGMA busy_timeout=0")
        connection.execute("PRAGMA page_size=4096")
        connection.execute(f"PRAGMA max_page_count={MAX_STORE_PAGES}")
        connection.execute("PRAGMA synchronous=FULL")
        if connection.execute("PRAGMA journal_mode").fetchone()[0] != "delete":
            raise ValueError("unsupported pending journal mode")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version == 0 and create:
            connection.execute("BEGIN IMMEDIATE")
            if connection.execute("SELECT 1 FROM sqlite_master LIMIT 1").fetchone():
                raise ValueError("unrecognized pending schema")
            connection.execute("CREATE TABLE items (id TEXT PRIMARY KEY, payload TEXT NOT NULL, generation INTEGER NOT NULL)")
            connection.execute("CREATE TABLE active (slot INTEGER PRIMARY KEY CHECK(slot=1), item_id TEXT NOT NULL)")
            connection.execute("CREATE TABLE events (id TEXT PRIMARY KEY, item_id TEXT NOT NULL)")
            connection.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
            connection.execute("COMMIT")
        elif version != SCHEMA_VERSION:
            raise ValueError("unsupported pending schema")
        yield connection
    finally:
        if connection.in_transaction:
            connection.execute("ROLLBACK")
        connection.close()


def _validated(raw: str) -> dict[str, Any]:
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > MAX_CONTROL_BYTES:
        raise ValueError("invalid pending control")
    item = json.loads(raw)
    if (not isinstance(item, dict) or set(item) != ITEM_KEYS or type(item["version"]) is not int
            or item["version"] != SCHEMA_VERSION):
        raise ValueError("invalid pending object")
    if not all(isinstance(item[key], str) and ID_RE.fullmatch(item[key]) for key in ("item_id", "event_id")):
        raise ValueError("invalid pending id")
    if not isinstance(item["state"], str) or item["state"] not in STATES or item["confirmed_kind"] not in {None, "create", "maintain", "select"}:
        raise ValueError("invalid pending state")
    if item["context_name"] is not None and not _token(item["context_name"]):
        raise ValueError("invalid pending context")
    if item["space_id"] is not None and _bounded(item["space_id"], MAX_CONTROL_BYTES) is None:
        raise ValueError("invalid pending space")
    reference = item["context_reference"]
    if reference is not None:
        allowed = {"name", "destination_id", "revision", "selection_digest", "scope_digest", "birth_digest", "agent_id", "space_id"}
        if (not isinstance(reference, dict) or set(reference) != allowed
                or _token(reference["name"]) is None or _token(reference["agent_id"]) is None
                or _bounded(reference["space_id"], MAX_CONTROL_BYTES) is None
                or not all(isinstance(reference[key], str) and ID_RE.fullmatch(reference[key])
                           for key in ("destination_id", "revision", "selection_digest", "scope_digest", "birth_digest"))):
            raise ValueError("invalid pending context reference")
    if item["profile"] is not None:
        from nmem_stop_maintenance import _profile_projection
        profile = item["profile"]
        if (not isinstance(profile, dict) or _token(profile.get("agent_id")) is None
                or _profile_projection(profile, profile.get("agent_id")) is None):
            raise ValueError("invalid pending public profile")
    operation = item["operation"]
    if operation is not None:
        if not isinstance(operation, dict) or _token(operation.get("operation_id")) is None:
            raise ValueError("invalid pending operation")
        if item["confirmed_kind"] == "maintain":
            if _maintenance_argv(item) is None:
                raise ValueError("invalid pending maintenance intent")
        elif (set(operation) != {"kind", "operation_id", "agent_id", "expected_context_revision",
                "intent_digest", "destination_id", "scope_digest", "birth_digest"}
                or operation["kind"] not in {"enroll", "select"} or _token(operation["agent_id"]) is None
                or (operation["intent_digest"] is not None and
                    (not isinstance(operation["intent_digest"], str) or not INTENT_DIGEST_RE.fullmatch(operation["intent_digest"])))
                or any(operation[key] is not None and (not isinstance(operation[key], str)
                    or not ID_RE.fullmatch(operation[key])) for key in
                    ("destination_id", "scope_digest", "birth_digest"))
                or (operation["expected_context_revision"] is not None and
                    (not isinstance(operation["expected_context_revision"], str)
                     or not ID_RE.fullmatch(operation["expected_context_revision"])))):
            raise ValueError("invalid pending creation reference")
    return item


def _read(connection, item_id: str | None = None):
    if item_id is None:
        row = connection.execute("SELECT i.payload,i.generation FROM active a JOIN items i ON i.id=a.item_id WHERE a.slot=1").fetchone()
    else:
        row = connection.execute("SELECT payload,generation FROM items WHERE id=?", (item_id,)).fetchone()
    return (_validated(row[0]), row[1]) if row else None


def read_pending() -> tuple[str, dict[str, Any] | None]:
    """Point read: absence differs from invalid/busy storage (which fences Context)."""
    try:
        database = _root() / "control.sqlite3"
        if _root().is_symlink() or _root().parent.is_symlink() or _root().parent.parent.is_symlink():
            return "unavailable", None
        if not database.exists() and not database.is_symlink():
            return "absent", None
        with _store() as connection:
            row = _read(connection)
        if not row or row[0]["state"] in TERMINAL_STATES:
            return "absent", None
        return "pending", row[0]
    except (OSError, sqlite3.Error, ValueError, TypeError, UnicodeError):
        return "unavailable", None


def retain_stop(event: dict[str, Any]) -> bool:
    """Bounded private IO only. A pre-commit crash never means a saved item."""
    from nmem_stop_maintenance import _enabled
    if not _enabled() or not isinstance(event, dict) or event.get("hook_event_name") != "Stop" or event.get("stop_hook_active") is not False:
        return False
    turn = _bounded(event.get("turn_id"), 256, nonempty=True)
    if turn is None:
        return False
    context = os.environ.get("NMEM_AGENT_CONTEXT", "").strip()
    if context and _token(context) is None:
        return False
    space = os.environ.get("NMEM_SPACE_ID")
    if space is not None and _bounded(space, MAX_CONTROL_BYTES) is None:
        return False
    # An ambient label is not an exact Space or enrollment authority.
    event_id = _digest(["codex-stop-pending-v1", str(_root().absolute()), turn])
    item = {"version": SCHEMA_VERSION, "item_id": event_id, "event_id": event_id,
            "context_name": context or None, "space_id": space, "state": "pending",
            "confirmed_kind": None, "operation": None, "context_reference": None, "profile": None}
    try:
        _encode(item)
        root = _root()
        _private_directory(root)
        claims = root / "events"
        claims.mkdir(mode=0o700, exist_ok=True)
        info = claims.lstat()
        if not stat.S_ISDIR(info.st_mode) or (os.name != "nt" and info.st_mode & 0o077):
            return False
        # Both package/fallback and missing/existing branches use exactly this
        # original-event claim. Never scan, expire or delete another claim.
        fd = os.open(claims / (event_id + ".claim"), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
        with _store(create=True) as connection:
            connection.execute("BEGIN IMMEDIATE")
            old = _read(connection)
            if old and old[0]["state"] not in TERMINAL_STATES:
                # Later Stops cannot replace unknown original intent.
                item = old[0]
            else:
                connection.execute("INSERT INTO items VALUES (?,?,0)", (item["item_id"], _encode(item)))
            connection.execute("INSERT INTO events VALUES (?,?)", (event_id, item["item_id"]))
            connection.execute("INSERT INTO active VALUES (1,?) ON CONFLICT(slot) DO UPDATE SET item_id=excluded.item_id", (item["item_id"],))
            connection.execute("COMMIT")
        return True
    except (OSError, sqlite3.Error, ValueError, TypeError, UnicodeError):
        return False


def _update(item_id: str, expected_generation: int, item: dict[str, Any]) -> bool:
    _validated(_encode(item))
    with _store() as connection:
        connection.execute("BEGIN IMMEDIATE")
        changed = connection.execute("UPDATE items SET payload=?,generation=generation+1 WHERE id=? AND generation=?", (_encode(item), item_id, expected_generation)).rowcount
        connection.execute("COMMIT")
    return changed == 1


def _public_reference(item: dict[str, Any]) -> dict[str, Any]:
    result = {key: item[key] for key in ("version", "item_id", "context_name", "space_id", "state", "confirmed_kind")}
    operation = item.get("operation")
    if isinstance(operation, dict):
        result["operation_id"] = _token(operation.get("operation_id"))
        if operation.get("kind") == "enroll":
            result["known_enrollment"] = operation.get("birth_digest") is not None
    return result


def _hint_reference(item: dict[str, Any]) -> str:
    reference = _public_reference(item)
    helper = _SCRIPT_DIR / "nmem_pending.py"
    helper_path = _bounded(str(helper), 512, nonempty=True)
    if helper_path is not None and helper.is_file():
        reference["helper_path"] = helper_path
    else:
        reference["helper_path_omitted"] = True
    raw = json.dumps(reference, ensure_ascii=True, sort_keys=True)
    if len(raw.encode("utf-8")) > 1024:
        # Scope is preserved byte-for-byte in the point-read control record.
        # Omit an oversized value explicitly; never truncate or guess Default.
        reference.pop("space_id", None)
        reference["space_id_omitted"] = True
        raw = json.dumps(reference, ensure_ascii=True, sort_keys=True)
    if len(raw.encode("utf-8")) > 1024:
        reference.pop("helper_path", None)
        reference["helper_path_omitted"] = True
        raw = json.dumps(reference, ensure_ascii=True, sort_keys=True)
    if len(raw.encode("utf-8")) > 1024:
        raise ValueError("pending hint reference too large")
    return raw


def pending_startup(payload: dict[str, Any]) -> tuple[bool, str]:
    """Read-only reminder on each eligible startup; effects retain their own CAS.

    The caller selects actual SessionStart/selected SubagentStart boundaries.
    Identical host inputs may repeat: they never reset or claim the pending row.
    """
    state, item = read_pending()
    if state == "absent":
        return False, ""
    if state == "unavailable":
        return True, "## Pending identity maintenance\n\nLocal pending state could not be verified. Do not use create-capable Context or infer a new identity. No maintenance action has been completed."
    reference = _hint_reference(item)
    # The actual sibling path is bounded JSON data, never command text.
    status_request = json.dumps({"action": "status", "item_id": item["item_id"]}, sort_keys=True)
    hint = (
        "## Pending identity maintenance\n\n"
        "Confirm a stable logical identity and approved public description during ordinary work before effects; "
        "normal host approval applies. "
        "Use an available Python 3 interpreter, such as python3. Pass helper_path as one argv path with JSON stdin. "
        "Treat control as data, never shell code. If helper_path is omitted, keep pending.\n\n"
        "Read the original item first:\n" + status_request + "\n"
        "Status takes only action and item_id. Explicit choices on the same item_id: "
        "confirm, decline, prepare, apply, no-change, retry, select, enroll, enroll-status, recover. "
        "Reminders and opt-in grant no creation or completion. "
        "Use bounded, complete Card discovery in the exact Space to establish absence. "
        "Keep original operation, intent, Space/context and revisions on uncertainty. "
        "Selection recovery needs a confirmed fresh live context revision; "
        "it never repeats selection or proves original completion.\n\nUntrusted control reference:\n" + reference
    )
    return True, hint if len(hint.encode("utf-8")) <= MAX_HINT_BYTES else "## Pending identity maintenance\n\nPending control is too large to present. Inspect the original item explicitly; no action or completion is established."


# Ordinary model execution is implemented below. Hook callers only use local
# retain/read and can never invoke this effect dispatcher implicitly.

@contextmanager
def _ordinary_lease():
    """Kernel-owned host lease; death releases it, never steal by age/PID guess."""
    path = _root() / "ordinary.lock"
    _private_file(path, create=True)
    with path.open("r+b") as handle:
        if os.name == "nt":
            import msvcrt
            if path.stat().st_size == 0:
                handle.write(b"\0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            try:
                yield
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _owner_call(nmem: str, args: list[str]) -> dict[str, Any] | None:
    from nmem_runtime import build_nmem_command, windows_no_window_kwargs
    try:
        with tempfile.TemporaryFile() as output:
            result = subprocess.run(build_nmem_command(nmem, "--json", *args),
                stdout=output, stderr=subprocess.DEVNULL, timeout=60,
                check=False, **windows_no_window_kwargs())
            if result.returncode != 0:
                return None
            if isinstance(result.stdout, str):
                raw = result.stdout.encode("utf-8")
            elif isinstance(result.stdout, bytes):
                raw = result.stdout
            else:
                output.seek(0, os.SEEK_END)
                if output.tell() > MAX_CONTROL_BYTES:
                    return None
                output.seek(0)
                raw = output.read(MAX_CONTROL_BYTES + 1)
        if len(raw) > MAX_CONTROL_BYTES:
            return None
        value = json.loads(raw)
        return value if isinstance(value, dict) else None
    except (OSError, subprocess.TimeoutExpired, ValueError, UnicodeError):
        return None


def _context_reference(nmem: str, name: str) -> dict[str, Any] | None:
    from nmem_stop_maintenance import _run_json, _selection_from_status
    shown = _run_json(nmem, ["agents", "context", "show", "--name", name])
    if not shown or shown.get("name") != name or shown.get("configured") is not True:
        return None
    destination = shown.get("destination_id")
    revision = shown.get("revision")
    selection = shown.get("selection")
    if (not isinstance(destination, str) or not ID_RE.fullmatch(destination)
            or not isinstance(revision, str) or not ID_RE.fullmatch(revision)
            or not isinstance(selection, dict)):
        return None
    address, scope = selection.get("address"), selection.get("scope")
    if not isinstance(address, dict) or not isinstance(scope, dict):
        return None
    agent, space = address.get("agent_id"), scope.get("space_id")
    if _token(agent) is None or _bounded(space, MAX_CONTROL_BYTES) is None:
        return None
    status = _run_json(nmem, ["--agent-context", name, "mailbox", "status"])
    live = _selection_from_status(status, name)
    # Status and local show must refer to the same current record, not just the
    # same profile fields. A second local point read closes a reselection seam.
    after = _run_json(nmem, ["agents", "context", "show", "--name", name])
    if (live != (agent, space) or not status or status.get("selection") != selection
            or not after or any(after.get(key) != shown.get(key)
            for key in ("name", "destination_id", "revision", "selection"))):
        return None
    birth = _bounded(address.get("identity_birth"), 1024, nonempty=True)
    if birth is None:
        return None
    return {"name": name, "destination_id": destination, "revision": revision,
            "selection_digest": _digest(selection), "scope_digest": _digest(scope), "birth_digest": _digest(birth),
            "agent_id": agent, "space_id": space}


def _approved_patch(value: Any) -> dict[str, Any] | None:
    from nmem_stop_maintenance import _string_list, MAX_DESCRIPTION_BYTES
    if not isinstance(value, dict) or not value or set(value) - {"description", "responsibilities", "skills"}:
        return None
    result: dict[str, Any] = {}
    if "description" in value:
        description = _bounded(value["description"], MAX_DESCRIPTION_BYTES)
        if description is None:
            return None
        result["description"] = description
    for key in ("responsibilities", "skills"):
        if key in value:
            entries = _string_list(value[key])
            if entries is None:
                return None
            result[key] = entries
    try:
        _encode(result)
    except ValueError:
        return None
    return result


def _maintenance_argv(item: dict[str, Any]) -> list[str] | None:
    from nmem_stop_maintenance import REVISION_RE
    operation = item.get("operation")
    if not isinstance(operation, dict) or set(operation) != {"kind", "operation_id", "expected_revision", "patch"}:
        return None
    kind, operation_id, revision = operation["kind"], operation["operation_id"], operation["expected_revision"]
    if kind not in {"apply", "no-change"} or _token(operation_id) is None or not isinstance(revision, str) or not REVISION_RE.fullmatch(revision):
        return None
    argv = ["--agent-context", item["context_name"], "agents", "maintenance", kind,
            "--operation-id", operation_id, "--expected-revision", revision]
    if kind == "no-change":
        return argv if operation["patch"] == {} else None
    patch = _approved_patch(operation["patch"])
    if patch is None:
        return None
    if "description" in patch:
        argv += ["--description", patch["description"]]
    for key, flag, clear in (("responsibilities", "--responsibility", "--clear-responsibilities"),
                             ("skills", "--skill", "--clear-skills")):
        if key in patch:
            if not patch[key]:
                argv.append(clear)
            for entry in patch[key]:
                argv += [flag, entry]
    return argv


def _result(item: dict[str, Any], notice: str = "") -> dict[str, Any]:
    result = _public_reference(item)
    result["original_completion"] = item["state"] == "completed"
    if notice:
        result["notice"] = notice
    return result


def _execute_maintenance(nmem: str, item: dict[str, Any], generation: int) -> dict[str, Any]:
    from nmem_stop_maintenance import _profile_projection
    argv = _maintenance_argv(item)
    reference = item["context_reference"]
    if not argv or not reference or _context_reference(nmem, item["context_name"]) != reference:
        return _result(item, "Original context is not currently verified; intent remains pending.")
    item["state"] = "unknown"
    # Persist exact intent before the owner may see the effect. Even a crash
    # before spawning is uncertainty, never an invented no-effect result.
    if not _update(item["item_id"], generation, item):
        return _result(item, "Pending state changed; no new dispatch admitted.")
    owner = _owner_call(nmem, argv)
    after = _context_reference(nmem, item["context_name"])
    if after != reference:
        item["state"] = "conflict"
    elif owner is not None:
        operation = item["operation"]
        profile = _profile_projection(owner.get("profile", {}), reference["agent_id"])
        if (owner.get("version") == 2 and owner.get("operation_id") == operation["operation_id"]
                and profile is not None and owner.get("status") in {"updated", "no_change", "already_satisfied"}):
            # Owner CLI already checks request and readback. The adapter checks
            # the original *context* too; fields alone are never context CAS.
            item["state"] = "desired_current" if owner["status"] == "already_satisfied" else "completed"
    _update(item["item_id"], generation + 1, item)
    return _result(item, "Current desired fields are observed; this is not an original-write receipt." if item["state"] == "desired_current" else "")


def ordinary_request(request: Any) -> dict[str, Any]:
    """Explicit model helper; no lifecycle hook calls this function."""
    from nmem_runtime import find_nmem_command
    from nmem_stop_maintenance import _profile_projection, _run_json, _operation_id
    if not isinstance(request, dict) or not isinstance(request.get("action"), str):
        return {"state": "pending", "notice": "Expected a bounded ordinary action request."}
    action = request["action"]
    admitted = {"status", "confirm", "decline", "prepare", "apply", "no-change", "retry", "select", "enroll", "enroll-status", "recover"}
    if action not in admitted or not isinstance(request.get("item_id"), str) or not ID_RE.fullmatch(request["item_id"]):
        return {"state": "pending", "notice": "Unsupported ordinary action; no owner effect admitted."}
    allowed = {"action", "item_id"} | {"confirm": {"kind", "context_name", "space_id"},
        "apply": {"patch"}, "select": {"agent_id", "expected_context_revision"},
        "enroll": {"agent_id", "expected_context_revision", "display_name", "description"},
        "recover": {"expected_context_revision"}}.get(action, set())
    if set(request) - allowed:
        return {"state": "pending", "notice": "Unsupported fields; no owner effect admitted."}
    try:
        _encode(request)
        with _ordinary_lease(), _store() as connection:
            row = _read(connection, request["item_id"])
            if row is None:
                return {"state": "pending", "notice": "Pending reference not verified."}
            item, generation = row
            if action == "status":
                result = _result(item)
                if item["profile"] is not None:
                    result["untrusted_public_profile"] = item["profile"]
                return result
            if item["state"] in TERMINAL_STATES:
                return _result(item)
            if action == "decline":
                if item["operation"] is not None:
                    return _result(item, "Possible dispatch cannot be relabeled as a no-effect decline.")
                item["state"] = "declined"
                _update(item["item_id"], generation, item)
                return _result(item)
            if action == "confirm":
                kind, name, space = request.get("kind"), _token(request.get("context_name")), request.get("space_id")
                if item["operation"] is not None:
                    return _result(item, "Reconcile the original operation before another proposal.")
                if kind not in {"create", "maintain", "select"} or name is None or _bounded(space, MAX_CONTROL_BYTES) is None:
                    return _result(item, "Confirm a stable context and exact Space explicitly.")
                if (item["context_name"] is not None and item["context_name"] != name
                        or item["space_id"] is not None and item["space_id"] != space):
                    return _result(item, "Captured context or exact Space differs; no effect admitted.")
                item.update(state="confirmed", confirmed_kind=kind, context_name=name, space_id=space)
                _update(item["item_id"], generation, item)
                return _result(item)
            nmem = find_nmem_command()
            if not nmem:
                return _result(item, "Pinned owner CLI unavailable; keep original intent pending.")
            if action == "retry":
                if not item["operation"]:
                    return _result(item, "No original operation to retry.")
                if item["confirmed_kind"] == "maintain":
                    return _execute_maintenance(nmem, item, generation)
                if item["confirmed_kind"] == "create" and item["operation"]["kind"] == "enroll":
                    owner = _owner_call(nmem, ["agents", "context", "enroll-retry", "--operation-id", item["operation"]["operation_id"]])
                    _observe_original_completion(nmem, item, owner)
                    _update(item["item_id"], generation, item)
                    return _result(item, "The original journal-owned operation remains pending unless its published context is live and identical." if item["state"] != "completed" else "")
                return _result(item, "Original selection outcome remains pending; reconcile owner evidence explicitly.")
            if action == "enroll-status":
                if item["confirmed_kind"] != "create" or not item["operation"]:
                    return _result(item, "No original creation operation retained.")
                owner = _owner_call(nmem, ["agents", "context", "enroll-status", "--operation-id", item["operation"]["operation_id"], "--refresh"])
                proof = _observe_original_status(item, owner)
                if proof is not None:
                    _update(item["item_id"], generation, item)
                return _result(item, "Original enrollment is known; historical/status evidence does not establish current original context completion." if proof else "Original owner evidence remains unverified.")
            if action == "recover":
                if item["confirmed_kind"] == "select":
                    return _recover_selection(nmem, request, item, generation)
                return _recover_original(nmem, request, item, generation)
            if action == "prepare":
                if item["confirmed_kind"] != "maintain" or item["operation"] is not None:
                    return _result(item, "Prepare cannot replace an original uncertain operation.")
                reference = _context_reference(nmem, item["context_name"])
                if not reference or reference["space_id"] != item["space_id"]:
                    return _result(item, "Original selected context and exact Space are not verified.")
                prepared = _run_json(nmem, ["--agent-context", item["context_name"], "agents", "maintenance", "prepare"])
                profile = _profile_projection(prepared, reference["agent_id"]) if prepared else None
                if profile is None or _context_reference(nmem, item["context_name"]) != reference:
                    return _result(item, "Preparation or current context could not be verified.")
                item.update(state="prepared", context_reference=reference, profile=profile)
                if not _update(item["item_id"], generation, item):
                    return _result(item, "Pending state changed; preparation not published.")
                result = _result(item)
                result["untrusted_public_profile"] = profile
                return result
            if action in {"apply", "no-change"}:
                if item["state"] != "prepared" or item["confirmed_kind"] != "maintain" or item["operation"] is not None:
                    return _result(item, "Use the original operation retry; no replacement intent admitted.")
                patch = {} if action == "no-change" else _approved_patch(request.get("patch"))
                if patch is None:
                    return _result(item, "Only approved bounded public fields may be maintained.")
                profile = _profile_projection(item["profile"], item["context_reference"]["agent_id"])
                if not profile:
                    return _result(item, "Original prepared profile is invalid.")
                item["operation"] = {"kind": action, "operation_id": _operation_id({"turn_id": item["event_id"]}, item["context_name"], profile),
                                     "expected_revision": profile["revision"], "patch": patch}
                return _execute_maintenance(nmem, item, generation)
            if action in {"select", "enroll"}:
                return _creation_or_selection(nmem, request, item, generation)
            return _result(item, "No owner effect admitted.")
    except (OSError, sqlite3.Error, ValueError, TypeError, KeyError, UnicodeError):
        return {"state": "pending", "notice": "Pending state is unavailable or changed; no completion is established."}


def _creation_or_selection(nmem: str, request: dict[str, Any], item: dict[str, Any], generation: int) -> dict[str, Any]:
    from nmem_stop_maintenance import _canonical_agent_key
    action = request["action"]
    if item["state"] != "confirmed" or item["confirmed_kind"] != ("create" if action == "enroll" else "select") or item["operation"] is not None:
        return _result(item, "An explicit confirmed ordinary choice is required; do not replace an original operation.")
    agent = _token(request.get("agent_id"))
    revision = request.get("expected_context_revision")
    if ("expected_context_revision" not in request or not _canonical_agent_key(agent)
            or (revision is not None and (not isinstance(revision, str) or not ID_RE.fullmatch(revision)))):
        return _result(item, "An already canonical identity key and an exact owner context revision are required.")
    argv = ["agents", "context", action, "--name", item["context_name"], "--agent-id", agent, "--space-id", item["space_id"]]
    if revision is not None:
        argv += ["--expected-revision", revision]
    operation_id = "codex-pending-v1:" + _digest([item["event_id"], action, item["context_name"], agent, item["space_id"], revision])
    if action == "enroll":
        argv += ["--operation-id", operation_id]
        for key, flag, maximum in (("display_name", "--display-name", 512), ("description", "--description", 4096)):
            if key in request:
                value = _bounded(request[key], maximum)
                if value is None:
                    return _result(item, "Invalid approved public creation field.")
                argv += [flag, value]
    # Full creation arguments and receipt remain solely in the owner journal.
    # The host stores only original operation/scope/context control references.
    item["operation"] = {"kind": action, "operation_id": operation_id,
                         "agent_id": agent, "expected_context_revision": revision,
                         "intent_digest": None, "destination_id": None, "scope_digest": None, "birth_digest": None}
    item["state"] = "unknown"
    if not _update(item["item_id"], generation, item):
        return _result(item, "Pending state changed; no new effect admitted.")
    owner = _owner_call(nmem, argv)
    if action == "enroll":
        _observe_original_completion(nmem, item, owner)
        _update(item["item_id"], generation + 1, item)
        return _result(item, "Original result remains pending unless the original published context is live and identical." if item["state"] != "completed" else "")
    reference = _context_reference(nmem, item["context_name"])
    selection = owner.get("selection") if owner else None
    if (action == "select" and owner and reference and reference["agent_id"] == agent
            and reference["space_id"] == item["space_id"] and isinstance(selection, dict)
            and owner.get("name") == reference["name"] and owner.get("revision") == reference["revision"]
            and owner.get("destination_id") == reference["destination_id"]
            and _digest(selection) == reference["selection_digest"]):
        # Selection is an observed current result, never an enrollment birth.
        item["state"] = "recovered_selection"
        _update(item["item_id"], generation + 1, item)
        return _result(item)
    return _result(item, "Original selection result requires owner evidence; retained pending, not completed.")


def _original_proof(item: dict[str, Any], proof: Any, digest: Any) -> bool:
    """Correlate transient owner evidence; never persist the receipt object."""
    from nmem_stop_maintenance import _typed_scope, _wire_identifier
    operation = item["operation"]
    allowed = {"version", "operation_id", "intent_digest", "agent_id", "scope", "identity_birth"}
    if (not isinstance(proof, dict) or set(proof) - (allowed | {"status"}) or not allowed <= set(proof)
            or type(proof.get("version")) is not int or proof["version"] != 1
            or proof["operation_id"] != operation["operation_id"]
            or proof["agent_id"] != operation["agent_id"] or proof["intent_digest"] != digest
            or not isinstance(digest, str) or not INTENT_DIGEST_RE.fullmatch(digest)
            or "status" in proof and proof["status"] not in {"created", "replayed"}
            or (operation["intent_digest"] is not None and operation["intent_digest"] != digest)
            or not _wire_identifier(proof["identity_birth"])):
        return False
    scope = proof["scope"]
    if (not _typed_scope(scope)
            or scope["space_id"] != item["space_id"]):
        return False
    scope_digest, birth_digest = _digest(scope), _digest(proof["identity_birth"])
    if (operation["scope_digest"] is not None and operation["scope_digest"] != scope_digest
            or operation["birth_digest"] is not None and operation["birth_digest"] != birth_digest):
        return False
    operation.update(intent_digest=digest, scope_digest=scope_digest, birth_digest=birth_digest)
    return True


def _owner_context_matches(item: dict[str, Any], record: Any, current: dict[str, Any] | None, proof: dict[str, Any]) -> bool:
    from nmem_stop_maintenance import _typed_selection
    if not current or not isinstance(record, dict):
        return False
    operation = item["operation"]
    selection = record.get("selection")
    if (not _typed_selection(selection)
            or selection["scope"] != proof["scope"] or selection["address"]["identity_birth"] != proof["identity_birth"]
            or record.get("name") != item["context_name"]
            or record.get("configured") is not True
            or record.get("destination_id") != current["destination_id"]
            or record.get("revision") != current["revision"]
            or _digest(selection) != current["selection_digest"]
            or current["name"] != item["context_name"]
            or current["agent_id"] != operation["agent_id"] or current["space_id"] != item["space_id"]
            or current["scope_digest"] != operation["scope_digest"]
            or current["birth_digest"] != operation["birth_digest"]
            or operation["destination_id"] is not None and operation["destination_id"] != current["destination_id"]):
        return False
    operation["destination_id"] = current["destination_id"]
    return True


def _observe_original_completion(nmem: str, item: dict[str, Any], owner: Any) -> None:
    if (not isinstance(owner, dict) or owner.get("state") != "completed"
            or owner.get("operation_id") != item["operation"]["operation_id"]
            or not _original_proof(item, owner.get("enrollment"), owner.get("intent_digest"))):
        return
    current = _context_reference(nmem, item["context_name"])
    if _owner_context_matches(item, owner.get("context"), current, owner["enrollment"]):
        item.update(state="completed", context_reference=current)
    else:
        item["state"] = "conflict"


def _observe_original_status(item: dict[str, Any], owner: Any) -> dict[str, Any] | None:
    if (not isinstance(owner, dict) or owner.get("state") not in {"enrolled", "completed"}
            or owner.get("operation_id") != item["operation"]["operation_id"]
            or owner.get("context_name") != item["context_name"]
            or owner.get("agent_id") != item["operation"]["agent_id"]
            or owner.get("space_id") != item["space_id"]
            or not isinstance(owner.get("destination_id"), str) or not ID_RE.fullmatch(owner["destination_id"])
            or item["operation"]["destination_id"] is not None and item["operation"]["destination_id"] != owner["destination_id"]
            or not _original_proof(item, owner.get("receipt"), owner.get("intent_digest"))):
        return None
    item["operation"]["destination_id"] = owner["destination_id"]
    # No current-result revision is present in this API. Even completed history
    # plus a currently similar identity must not become current completion.
    return owner["receipt"]


def _recover_selection(nmem: str, request: dict[str, Any], item: dict[str, Any], generation: int) -> dict[str, Any]:
    """Accept explicitly confirmed current selection without replaying a write."""
    operation = item["operation"]
    if item["state"] != "unknown" or not operation or operation["kind"] != "select":
        return _result(item, "No original uncertain selection to reconcile.")
    revision = request.get("expected_context_revision")
    if not isinstance(revision, str) or not ID_RE.fullmatch(revision):
        return _result(item, "Explicitly confirm a fresh current context revision before selection recovery.")
    current = _context_reference(nmem, item["context_name"])
    if (not current or current["name"] != item["context_name"]
            or current["revision"] != revision
            or current["agent_id"] != operation["agent_id"]
            or current["space_id"] != item["space_id"]
            or any(operation[key] is not None and operation[key] != current[key]
                   for key in ("destination_id", "scope_digest", "birth_digest"))):
        return _result(item, "Current owner selection does not match the explicit choice and retained binding.")
    # Legacy unknown selections may lack a retained birth/destination. This is
    # an explicit acceptance of current live selection, never historical proof
    # that the original select succeeded. Preserve every original operation field.
    recovered = dict(item, state="recovered_selection", context_reference=current)
    if not _update(item["item_id"], generation, recovered):
        return _result(item, "Pending state changed; no selection recovery published.")
    return _result(recovered, "Current selection confirmed; original selection completion remains unknown. No owner write was repeated.")


def _recover_original(nmem: str, request: dict[str, Any], item: dict[str, Any], generation: int) -> dict[str, Any]:
    if item["confirmed_kind"] != "create" or not item["operation"] or item["operation"].get("kind") != "enroll":
        return _result(item, "No original creation proof to recover.")
    revision = request.get("expected_context_revision")
    if "expected_context_revision" not in request or (revision is not None and
            (not isinstance(revision, str) or not ID_RE.fullmatch(revision))):
        return _result(item, "Supply an explicit fresh owner context revision or explicit confirmed absence.")
    owner_status = _owner_call(nmem, ["agents", "context", "enroll-status", "--operation-id", item["operation"]["operation_id"], "--refresh"])
    proof = _observe_original_status(item, owner_status)
    if proof is None:
        return _result(item, "Original owner proof is unavailable; do not select or substitute another operation.")
    argv = ["agents", "context", "enroll-recover", "--name", item["context_name"], "--receipt-json", _encode(proof)]
    if revision is not None:
        argv += ["--expected-revision", revision]
    item["state"] = "unknown"
    if not _update(item["item_id"], generation, item):
        return _result(item, "Pending state changed; recovery not dispatched.")
    owner = _owner_call(nmem, argv)
    current = _context_reference(nmem, item["context_name"])
    if (owner and owner.get("state") == "selected" and owner.get("original_client_completion") == "unknown"
            and _original_proof(item, owner.get("enrollment"), item["operation"]["intent_digest"])
            and _owner_context_matches(item, owner.get("context"), current, owner["enrollment"])):
        item.update(state="recovered_selection", context_reference=current)
    _update(item["item_id"], generation + 1, item)
    return _result(item, "Selection recovery does not establish original client completion.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    try:
        raw = sys.stdin.read(MAX_CONTROL_BYTES + 1)
        if len(raw.encode("utf-8")) > MAX_CONTROL_BYTES:
            raise ValueError("request too large")
        response = ordinary_request(json.loads(raw))
    except (ValueError, UnicodeError):
        response = {"state": "pending", "notice": "Invalid bounded ordinary action request."}
    json.dump(response, sys.stdout, ensure_ascii=True, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

