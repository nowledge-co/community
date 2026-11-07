"""Shared runtime for the Nowledge Mem hooks for Dim.

Standard library only. Every read and every write is bounded, every failure is
fail-open, and the diagnostic log carries no conversation content.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

MAX_INPUT_BYTES = 256 * 1024
MAX_RESPONSE_BYTES = 256 * 1024
MAX_LOG_BYTES = 64 * 1024
STATE_PARENT = "nowledge-mem"
LOG_NAME = "nowledge-mem-dim-hook.log"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)


def read_event() -> Dict[str, Any]:
    """Reads one bounded JSON object from stdin; anything else is empty."""
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
    except (OSError, ValueError):
        return {}
    if not raw or len(raw) > MAX_INPUT_BYTES:
        return {}
    try:
        value = json.loads(raw.decode("utf-8", "strict"))
    except (ValueError, UnicodeError):
        return {}
    return value if isinstance(value, dict) else {}


def event_text(event: Dict[str, Any], key: str, limit: int = 1024) -> str:
    value = event.get(key)
    if not isinstance(value, str) or not value:
        return ""
    if "\x00" in value or len(value) > limit:
        return ""
    return value


def state_root() -> Optional[Path]:
    """The nmem-side state root, or None when it cannot be trusted.

    On POSIX the base temporary directory can be shared by every local user,
    so the package uses a per-user component and verifies it after creating
    it: a real directory, owned by this user, with no group or other access.
    A failed check means capture writes nothing, not even a log line. Windows
    keeps the per-user %TEMP% directory unchanged.
    """
    base = Path(tempfile.gettempdir()) / STATE_PARENT
    if os.name == "nt":
        root = base / state_dirname()
        try:
            root.mkdir(mode=0o700, parents=True, exist_ok=True)
        except OSError:
            return None
        return root
    root = base / state_dirname()
    if not _safe_parent(base) or not _private_dir(root):
        return None
    return root


def state_dirname() -> str:
    """The per-user state directory name under the shared temp directory."""
    return "dim-capture" if os.name == "nt" else "dim-capture-%d" % os.getuid()


def _safe_parent(path: Path) -> bool:
    """Creates the shared parent if needed; it must be ours, not a link.

    Other Nowledge Mem packages create this parent too, so its mode is not
    enforced here. The per-user child is the directory that must be private.
    """
    try:
        path.mkdir(mode=0o700, exist_ok=True)
        info = path.lstat()
    except OSError:
        return False
    return stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid()


def _private_dir(path: Path) -> bool:
    """Creates `path` if needed, then checks it is ours and closed to others."""
    try:
        path.mkdir(mode=0o700, exist_ok=True)
        info = path.lstat()
    except OSError:
        return False
    if not stat.S_ISDIR(info.st_mode):
        return False
    if info.st_uid != os.getuid():
        return False
    return not info.st_mode & 0o077


def session_key(home: str, session_id: str) -> str:
    """A stable key for one Session in one Dim home; never a path."""
    digest = hashlib.sha256()
    digest.update(b"dim-session\x00")
    digest.update(home.encode("utf-8", "surrogateescape"))
    digest.update(b"\x00")
    digest.update(session_id.encode("utf-8", "surrogateescape"))
    return digest.hexdigest()[:32]


def write_private(path: Path, data: bytes) -> bool:
    """Writes a regular file, 0600, without following a planted symlink."""
    try:
        descriptor = os.open(
            str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC | NOFOLLOW, 0o600
        )
        try:
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode):
                return False
            if hasattr(os, "fchmod"):
                os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "wb") as handle:
                descriptor = -1
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            return True
        finally:
            if descriptor >= 0:
                os.close(descriptor)
    except OSError:
        return False


def read_private(path: Path, limit: int) -> Optional[bytes]:
    try:
        descriptor = os.open(str(path), os.O_RDONLY | NOFOLLOW)
    except OSError:
        return None
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            return None
        with os.fdopen(descriptor, "rb") as handle:
            descriptor = -1
            return handle.read()
    except OSError:
        return None
    finally:
        if descriptor >= 0:
            os.close(descriptor)


def log(record: Dict[str, Any]) -> None:
    """Appends one content-free JSON line; the file never exceeds 64 KiB."""
    root = state_root()
    if root is None:
        return
    try:
        entry = dict(record)
        entry["at"] = int(time.time())
        line = json.dumps(entry, ensure_ascii=True, sort_keys=True) + "\n"
        data = line.encode("utf-8", "replace")
        path = root / LOG_NAME
        flags = os.O_WRONLY | os.O_APPEND | os.O_CREAT | NOFOLLOW
        try:
            if path.stat().st_size + len(data) > MAX_LOG_BYTES:
                truncate = os.open(
                    str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC | NOFOLLOW, 0o600
                )
                os.close(truncate)
        except OSError:
            pass
        descriptor = os.open(str(path), flags, 0o600)
        try:
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode):
                return
            if hasattr(os, "fchmod"):
                os.fchmod(descriptor, 0o600)
            os.write(descriptor, data)
        finally:
            os.close(descriptor)
    except (OSError, ValueError, TypeError):
        pass


def find_nmem() -> str:
    """Finds the nmem CLI: NMEM_CLI_PATH, PATH, then known install places."""
    configured = os.environ.get("NMEM_CLI_PATH", "").strip()
    if configured:
        expanded = os.path.expandvars(os.path.expanduser(configured))
        if os.sep in expanded or (os.altsep and os.altsep in expanded):
            return expanded if _executable(expanded) else ""
        found = shutil.which(expanded)
        return found or ""
    for name in ("nmem", "nmem.exe", "nmem.cmd"):
        found = shutil.which(name)
        if found:
            return found
    home = Path(os.path.expanduser("~"))
    candidates: List[Path] = [
        home / ".local" / "bin" / "nmem",
        home / ".local" / "share" / "nowledge-mem" / "bin" / "nmem-wrapper",
        Path("/usr/local/bin/nmem"),
        Path("/opt/homebrew/bin/nmem"),
    ]
    for candidate in candidates:
        if _executable(str(candidate)):
            return str(candidate)
    return ""


def _executable(path: str) -> bool:
    return os.path.isfile(path) and os.access(path, os.X_OK)


def run_json(executable: str, args: Sequence[str], timeout: float) -> Tuple[bool, Dict[str, Any]]:
    """Runs a CLI command and parses one JSON object from its stdout."""
    if not executable:
        return False, {}
    try:
        completed = subprocess.run(
            [executable] + list(args),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=max(0.5, timeout),
            check=False,
            creationflags=CREATE_NO_WINDOW,
        )
    except (OSError, ValueError, subprocess.SubprocessError):
        return False, {}
    if completed.returncode != 0 or len(completed.stdout) > MAX_RESPONSE_BYTES:
        return False, {}
    try:
        payload = json.loads(completed.stdout.decode("utf-8", "replace"))
    except ValueError:
        return False, {}
    return True, payload if isinstance(payload, dict) else {}


def run_json_any(
    executable: str, args: Sequence[str], timeout: float
) -> Tuple[bool, Dict[str, Any]]:
    """Like run_json, but keeps a JSON object printed on a non-zero exit.

    `nmem t import` reports a typed checkpoint conflict as JSON on stdout with
    a non-zero exit code; the payload, not the exit code, decides.
    """
    if not executable:
        return False, {}
    try:
        completed = subprocess.run(
            [executable] + list(args),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=max(0.5, timeout),
            check=False,
            creationflags=CREATE_NO_WINDOW,
        )
    except (OSError, ValueError, subprocess.SubprocessError):
        return False, {}
    if len(completed.stdout) > MAX_RESPONSE_BYTES:
        return completed.returncode == 0, {}
    try:
        payload = json.loads(completed.stdout.decode("utf-8", "replace"))
    except ValueError:
        return completed.returncode == 0, {}
    return completed.returncode == 0, payload if isinstance(payload, dict) else {}


def run_capped(
    executable: str, args: Sequence[str], timeout: float, limit: int
) -> Tuple[Optional[bytes], str]:
    """Runs a child and keeps at most `limit` stdout bytes.

    Returns (stdout, reason); stdout is None on any failure, and `reason` is a
    short code with no output in it.
    """
    try:
        process = subprocess.Popen(
            [executable] + list(args),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            creationflags=CREATE_NO_WINDOW,
        )
    except (OSError, ValueError):
        return None, "spawn_failed"
    if process.stdout is None:
        _terminate(process)
        return None, "spawn_failed"
    chunks: List[bytes] = []
    state = {"total": 0, "overflow": False}

    def reader() -> None:
        try:
            while True:
                chunk = process.stdout.read(65536)
                if not chunk:
                    return
                if state["total"] + len(chunk) > limit:
                    state["overflow"] = True
                    _terminate(process)
                    return
                chunks.append(chunk)
                state["total"] += len(chunk)
        except (OSError, ValueError):
            return
        finally:
            process.stdout.close()

    thread = threading.Thread(target=reader, daemon=True)
    thread.start()
    try:
        process.wait(timeout=max(0.5, timeout))
    except subprocess.TimeoutExpired:
        _terminate(process)
        return None, "timeout"
    thread.join(timeout=2)
    if thread.is_alive():
        # A grandchild still holds stdout open. The joined chunks are not the
        # complete output, so they must not be returned as success.
        _terminate(process)
        return None, "timeout"
    if state["overflow"]:
        return None, "too_large"
    if process.returncode != 0:
        return None, "exit_%d" % process.returncode
    return b"".join(chunks), ""


def _terminate(process: subprocess.Popen) -> None:
    try:
        process.kill()
    except OSError:
        return
    try:
        process.wait(timeout=5)
    except (OSError, subprocess.SubprocessError):
        pass


def dim_binary(home: str) -> str:
    """The one executable a hook may run (never PATH).

    1. NMEM_DIM_BIN, the user's explicit override;
    2. <home>/rust/dimcode-server, the link Dim's CLI points at the running
       daemon's own build;
    3. nothing.
    """
    override = os.environ.get("NMEM_DIM_BIN", "").strip()
    if override:
        expanded = os.path.expandvars(os.path.expanduser(override))
        return expanded if _executable(expanded) else ""
    if not home:
        return ""
    name = "dimcode-server.exe" if os.name == "nt" else "dimcode-server"
    candidate = Path(home) / "rust" / name
    return str(candidate) if _executable(str(candidate)) else ""


def exact_space(value: Any) -> bool:
    if not isinstance(value, str) or not value or "\x00" in value:
        return False
    try:
        value.encode("utf-8")
    except UnicodeError:
        return False
    return True


def space_selectors(nmem: str, timeout: float) -> Tuple[List[str], Optional[str], bool]:
    """Resolves the ambient Space/agent selectors from the environment.

    Returns (selectors, agent_id, resolved). `resolved` is False only when a
    named selector was given and could not be verified; capture then skips
    rather than writing to a lane the caller did not choose.
    """
    selectors: List[str] = []
    agent_id: Optional[str] = None
    name = os.environ.get("NMEM_AGENT_CONTEXT", "").strip()
    space = os.environ.get("NMEM_SPACE", "").strip()
    legacy = os.environ.get("NMEM_SPACE_ID")
    agent = os.environ.get("NMEM_AGENT_ID", "").strip()
    alias = os.environ.get("NMEM_HOST_AGENT_ID", "").strip()
    if name:
        if re.fullmatch(r"[A-Za-z0-9_.:-]{1,120}", name) is None:
            return [], None, False
        ok, selected = run_json(nmem, ["--json", "agents", "context", "show", "--name", name], timeout)
        selection = selected.get("selection") if ok else None
        scope = selection.get("scope") if isinstance(selection, dict) else None
        exact = scope.get("space_id") if isinstance(scope, dict) else None
        if not ok or selected.get("name") != name or not exact_space(exact):
            return [], None, False
        if agent or space or legacy is not None or alias:
            return [], None, False
        return ["--space-id", exact], None, True
    if space:
        if not exact_space(space) or (legacy is not None and legacy != space):
            return [], None, False
        return ["--space", space], agent or None, True
    if legacy is not None:
        if not exact_space(legacy):
            return [], None, False
        return ["--space-id", legacy], agent or None, True
    if alias and not agent:
        return [], None, False
    if agent:
        if re.fullmatch(r"[a-z0-9][a-z0-9_.:-]{0,119}", agent) is None:
            return [], None, False
        ok, profile = run_json(nmem, ["--json", "agents", "show", agent], timeout)
        if not ok or profile.get("id") != agent or not exact_space(profile.get("defaultSpaceId")):
            return [], None, False
        if alias and profile.get("hostAgentId") != alias:
            return [], None, False
        return ["--space-id", profile["defaultSpaceId"]], agent, True
    return [], None, True


def safe_thread_id(session_id: str) -> str:
    """`dim-<session-id>` with anything outside the safe set replaced."""
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", session_id).strip("-")
    return "dim-" + (safe if safe else "session")
