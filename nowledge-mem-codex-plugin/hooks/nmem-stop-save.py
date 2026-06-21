#!/usr/bin/env python3
"""Best-effort Codex transcript capture for Nowledge Mem Stop hooks."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any


ATTEMPT_TIMEOUT_SECONDS = 8
SAVE_RETRY_DELAYS_SECONDS = (0.0, 0.5, 1.5, 3.0)
CAPTURE_LOCK_STALE_SECONDS = 90

# Ordered by preference: /etc/machine-id (systemd/Linux standard),
# then overlay root mountinfo (Docker/LazyCat containers).
_FINGERPRINT_SOURCES = (
    "/etc/machine-id",
    "__mac__",
    "/proc/1/mountinfo",
)


def _host_agent_fingerprint() -> str:
    """Derive a stable agent-identity fingerprint from system sources.

    Ordered by preference:
    1. /etc/machine-id — systemd / standard Linux hosts.
    2. MAC address — first non-loopback interface from /sys/class/net.
    3. /proc/1/mountinfo — overlay upperdir layer hash (Docker/LazyCat).

    Prefixes: machine-id/MAC → "codex-XXXXXXXX", overlay → "overlay-XXXXXXXX".
    """
    for source in _FINGERPRINT_SOURCES:
        if source == "__mac__":
            raw = _read_mac_address()
        else:
            try:
                raw = Path(source).read_text(encoding="utf-8").strip()
            except (OSError, UnicodeDecodeError):
                continue
        if not raw:
            continue
        if source == "/proc/1/mountinfo":
            extracted = _extract_overlay_id(raw)
            if not extracted:
                continue
            raw = extracted
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:8]
        if source == "/proc/1/mountinfo":
            return f"overlay-{digest}"
        return f"{prefix}-{digest}"
    return ""


def _read_mac_address() -> str:
    """Return the first non-loopback MAC address from /sys/class/net."""
    net_dir = Path("/sys/class/net")
    if not net_dir.is_dir():
        return ""
    try:
        ifaces = sorted(p.name for p in net_dir.iterdir() if p.is_dir())
    except OSError:
        return ""
    for iface in ifaces:
        if iface == "lo":
            continue
        addr_path = net_dir / iface / "address"
        try:
            addr = addr_path.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeDecodeError):
            continue
        if addr and addr != "00:00:00:00:00:00":
            return addr
    return ""


def _extract_overlay_id(mountinfo: str) -> str:
    """Pull the overlay upperdir layer hash from /proc/1/mountinfo."""
    import re as _re
    for line in mountinfo.splitlines():
        if "upperdir=" not in line:
            continue
        m = _re.search(r"upperdir=([^,]+)", line)
        if not m:
            continue
        parts = m.group(1).rstrip("/").split("/")
        for part in reversed(parts):
            if len(part) >= 32 and all(c in "0123456789abcdef" for c in part):
                return part
    return ""def _nmem_command() -> str | None:
    return shutil.which("nmem") or shutil.which("nmem.cmd")


def _cmd_exe_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    parts = normalized.split("/")
    if (
        len(parts) > 3
        and parts[0] == ""
        and parts[1] == "mnt"
        and len(parts[2]) == 1
    ):
        return f"{parts[2].upper()}:\\" + "\\".join(parts[3:])
    if len(path) >= 3 and path[1] == ":" and path[2] in ("\\", "/"):
        return path.replace("/", "\\")
    if normalized.startswith("/"):
        wslpath = shutil.which("wslpath")
        if wslpath:
            try:
                proc = subprocess.run(
                    [wslpath, "-w", path],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=2,
                    check=False,
                )
                converted = proc.stdout.strip()
                if proc.returncode == 0 and converted:
                    return converted
            except Exception:
                pass
        distro = os.environ.get("WSL_DISTRO_NAME")
        if distro:
            return "\\\\wsl.localhost\\" + distro + normalized.replace("/", "\\")
    return "nmem.cmd" if Path(path).name.lower() == "nmem.cmd" else path


def _build_nmem_command(nmem: str, *args: str) -> list[str]:
    if nmem.lower().endswith(".cmd"):
        if os.name == "nt":
            return [nmem, *args]
        return [
            "cmd.exe",
            "/c",
            subprocess.list2cmdline([_cmd_exe_path(nmem), *args]),
        ]
    return [nmem, *args]


def _derive_codex_home(transcript_path: str | None) -> Path | None:
    if not transcript_path:
        return None
    path = Path(transcript_path).expanduser()
    for parent in (path.parent, *path.parents):
        if parent.name == "sessions":
            return parent.parent
    return None


def _build_env(payload: dict[str, Any]) -> dict[str, str]:
    env = os.environ.copy()
    if not env.get("CODEX_HOME"):
        derived = _derive_codex_home(_payload_value(payload, "transcript_path", "transcriptPath"))
        if derived:
            env["CODEX_HOME"] = str(derived)
    return env


def _build_save_command(
    nmem: str,
    payload: dict[str, Any],
    *,
    include_session_id: bool,
    json_output: bool = True,
) -> list[str]:
    args = (["--json"] if json_output else []) + [
        "t",
        "save",
        "--from",
        "codex",
        "--truncate",
    ]

    # NOTE: --host-agent-id requires nmem CLI >= TBD (currently unrecognized).
    # The nmem maintainer has been asked to add this flag to 'nmem t save'.
    # Until then, this is a no-op — the process will still succeed; nmem simply
    # ignores unrecognized flags in subprocess mode.
    host_agent_id = _host_agent_fingerprint()
    if host_agent_id:
        args.extend(["--host-agent-id", host_agent_id])

    cwd = _payload_value(payload, "cwd")
    if cwd:
        project = str(Path(cwd).expanduser())
        if nmem.lower().endswith(".cmd"):
            project = _cmd_exe_path(project)
        args.extend(["--project", project])

    session_id = _payload_value(payload, "session_id", "sessionId")
    if include_session_id and session_id:
        args.extend(["--session-id", session_id])

    return _build_nmem_command(nmem, *args)


def _run_save(
    nmem: str,
    payload: dict[str, Any],
    *,
    include_session_id: bool,
    json_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    command = _build_save_command(
        nmem,
        payload,
        include_session_id=include_session_id,
        json_output=json_output,
    )
    _log(f"run: {subprocess.list2cmdline(command)}")
    return subprocess.run(
        command,
        env=_build_env(payload),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=ATTEMPT_TIMEOUT_SECONDS,
        check=False,
    )


def _json_flag_unsupported(proc: subprocess.CompletedProcess[str]) -> bool:
    text = f"{proc.stdout}\n{proc.stderr}".lower()
    return any(marker in text for marker in JSON_FLAG_UNSUPPORTED_MARKERS)


def _capture_has_result(stdout: str) -> bool:
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        return bool(stdout.strip())
    if not isinstance(payload, dict):
        return False
    results = payload.get("results")
    return isinstance(results, list) and len(results) > 0


def _run_save_with_retries(
    nmem: str,
    payload: dict[str, Any],
    *,
    include_session_id: bool,
) -> tuple[bool, subprocess.CompletedProcess[str]]:
    last_proc = subprocess.CompletedProcess([], 0, stdout="", stderr="")
    for delay in SAVE_RETRY_DELAYS_SECONDS:
        if delay:
            time.sleep(delay)
        try:
            last_proc = _run_save(
                nmem,
                payload,
                include_session_id=include_session_id,
                json_output=True,
            )
        except subprocess.TimeoutExpired as exc:
            last_proc = subprocess.CompletedProcess(
                [],
                124,
                stdout=exc.stdout or "",
                stderr=f"capture attempt timed out after {ATTEMPT_TIMEOUT_SECONDS}s",
            )
            continue
        if last_proc.returncode != 0 and _json_flag_unsupported(last_proc):
            try:
                last_proc = _run_save(
                    nmem,
                    payload,
                    include_session_id=include_session_id,
                    json_output=False,
                )
            except subprocess.TimeoutExpired as exc:
                last_proc = subprocess.CompletedProcess(
                    [],
                    124,
                    stdout=exc.stdout or "",
                    stderr=(
                        f"legacy capture attempt timed out after "
                        f"{ATTEMPT_TIMEOUT_SECONDS}s"
                    ),
                )
                continue
            if last_proc.returncode == 0:
                return True, last_proc
            continue
        if last_proc.returncode == 0 and _capture_has_result(last_proc.stdout or ""):
            return True, last_proc
    return False, last_proc


def _looks_like_session_lookup_miss(proc: subprocess.CompletedProcess[str]) -> bool:
    text = f"{proc.stdout}\n{proc.stderr}"
    return any(marker in text for marker in SESSION_NOT_FOUND_MARKERS)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default="stop", help="Diagnostic event label.")
    args, _ = parser.parse_known_args()

    payload = _read_hook_input()
    session_id = _payload_value(payload, "session_id", "sessionId")
    cwd = _payload_value(payload, "cwd")
    transcript_path = _payload_value(payload, "transcript_path", "transcriptPath")
    _log(
        f"start event={args.event} session={session_id or 'missing'} "
        f"cwd={cwd or 'missing'} transcript={transcript_path or 'missing'}"
    )

    nmem = _nmem_command()
    if not nmem:
        _log("skip: nmem not found")
        return 0

    if not _claim_capture_event(payload):
        _log("skip: duplicate Stop hook event already claimed")
        return 0

    try:
        captured, proc = _run_save_with_retries(
            nmem, payload, include_session_id=bool(session_id)
        )
    except Exception as exc:
        _log(f"skip: capture failed: {exc}")
        return 0

    if proc.returncode != 0 and session_id and _looks_like_session_lookup_miss(proc):
        _log("retry: session-id lookup missed; falling back to latest project session")
        try:
            captured, proc = _run_save_with_retries(
                nmem, payload, include_session_id=False
            )
        except Exception as exc:
            _log(f"skip: fallback capture failed: {exc}")
            return 0

    if proc.returncode == 0 and not captured:
        _log("skip: no flushed transcript found")

    _log(f"nmem_exit={proc.returncode}")
    if proc.stdout.strip():
        _log(f"stdout: {proc.stdout.strip()}")
    if proc.stderr.strip():
        _log(f"stderr: {proc.stderr.strip()}")
    _log("")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
