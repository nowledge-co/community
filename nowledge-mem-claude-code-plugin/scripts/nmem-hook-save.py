#!/usr/bin/env python3
"""Best-effort Claude Code / Grok Build transcript capture for Nowledge Mem hooks."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


# The Stop / PreCompact hooks in hooks.json kill this process at 35s. Keep the
# whole retry loop under that with headroom (TOTAL_BUDGET). A single
# `nmem t save` of a large session on the 0.10.x Rust CLI routinely needs well
# over the old 8s per-attempt cap: it is a fresh process (cold start) that parses
# the full transcript and persists to the backend. An 8s cap timed out every
# attempt on big sessions / slower machines / cold backends, so the hook reported
# "no flushed transcript found" even though nothing was wrong — the capture just
# needed more time. We now give each attempt real room (PER_ATTEMPT_TIMEOUT) and
# bound the TOTAL instead. Retries still exist to ride out a backend that is
# briefly not ready right after SessionStart (those attempts fail fast, so the
# short early delays let a later attempt succeed once the server is up).
TOTAL_BUDGET_SECONDS = 30.0
PER_ATTEMPT_TIMEOUT_SECONDS = 20
SKILL_OUTCOME_TIMEOUT_SECONDS = 8
SAVE_RETRY_DELAYS_SECONDS = (0.0, 0.5, 1.5, 3.0)
JSON_FLAG_UNSUPPORTED_MARKERS = (
    "no such option: --json",
    "unrecognized arguments: --json",
    "unknown option --json",
    "unexpected argument '--json'",
)

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

try:
    from skill_outcome import build_outcome_args, extract_skill_outcomes_from_file
except Exception:  # pragma: no cover - defensive for partial installs
    build_outcome_args = None
    extract_skill_outcomes_from_file = None


def _windows_no_window_kwargs() -> dict[str, int]:
    if sys.platform != "win32":
        return {}
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)}


def _read_hook_input() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _payload_value(payload: dict[str, Any], *keys: str) -> str | None:
    containers: list[dict[str, Any]] = [payload]
    for outer_key in ("input", "data"):
        nested = payload.get(outer_key)
        if isinstance(nested, dict):
            containers.append(nested)
            nested_input = nested.get("input")
            if isinstance(nested_input, dict):
                containers.append(nested_input)

    for container in containers:
        for key in keys:
            value = container.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def _nmem_command() -> str | None:
    # Windows shims are wrapped by _build_nmem_command before execution.
    return shutil.which("nmem") or shutil.which("nmem.cmd")


def _host_runtime() -> str:
    if (
        os.environ.get("GROK_SESSION_ID")
        or os.environ.get("GROK_HOOK_EVENT")
        or os.environ.get("GROK_WORKSPACE_ROOT")
        or os.environ.get("GROK_PLUGIN_ROOT")
    ):
        return "grok"
    return "claude-code"


def _runtime_label(runtime: str) -> str:
    return "Grok Build" if runtime == "grok" else "Claude Code"


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
        return [
            "cmd.exe",
            "/s",
            "/c",
            subprocess.list2cmdline([_cmd_exe_path(nmem), *args]),
        ]
    return [nmem, *args]


def _resolve_space_from_cwd(project_path: Path) -> str | None:
    """Resolve the Nowledge Mem space ONLY from an explicit ``$NMEM_SPACE``.

    Space is a user-owned concept: the plugin must never infer or invent one.
    We deliberately do NOT derive a space from the repo / cwd. The old
    git-basename derivation tagged every captured thread with a repo-named space
    the user never created, which then surfaced as an auto-created space in the
    app (e.g. just reading an open-source project spawned a "space"). When
    ``$NMEM_SPACE`` is unset, no ``--space`` is passed and the thread lands in
    the user's default space, exactly as if the user had not opted into spaces.

    ``project_path`` is retained for call-site compatibility but is intentionally
    unused now that no cwd-based inference happens.
    """
    del project_path  # no cwd/git inference — space must be explicit
    env_space = (os.environ.get("NMEM_SPACE") or "").strip().lower()
    return env_space or None


def _build_command(
    nmem: str,
    payload: dict[str, Any],
    *,
    json_output: bool = True,
) -> list[str]:
    runtime = _host_runtime()
    args = (["--json"] if json_output else []) + [
        "t",
        "save",
        "--from",
        runtime,
        "--truncate",
    ]

    session_id = _payload_value(payload, "session_id", "sessionId") or os.environ.get(
        "GROK_SESSION_ID", ""
    ).strip()
    if session_id:
        args.extend(["--session-id", session_id])

    cwd = (
        _payload_value(payload, "cwd")
        or os.environ.get("GROK_WORKSPACE_ROOT", "").strip()
        or os.environ.get("CLAUDE_PROJECT_DIR", "").strip()
    )
    if cwd:
        project_path = Path(cwd).expanduser()
        project = str(project_path if nmem.lower().endswith(".cmd") else project_path.resolve())
        if nmem.lower().endswith(".cmd"):
            project = _cmd_exe_path(project)
        args.extend(["--project", project])

        space = _resolve_space_from_cwd(project_path)
        if space:
            args.extend(["--space", space])

    return _build_nmem_command(nmem, *args)


def _json_flag_unsupported(proc: subprocess.CompletedProcess[str]) -> bool:
    text = f"{proc.stdout}\n{proc.stderr}".lower()
    return any(marker in text for marker in JSON_FLAG_UNSUPPORTED_MARKERS)


def _capture_has_result(stdout: str) -> bool:
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        # Older nmem versions did not always expose machine-readable output. If
        # the command succeeded and printed non-JSON output, keep legacy behavior.
        return bool(stdout.strip())

    if not isinstance(payload, dict):
        return False
    results = payload.get("results")
    return isinstance(results, list) and len(results) > 0


def _run_command(command: list[str], timeout: float) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
        **_windows_no_window_kwargs(),
    )


def _transcript_fingerprint(transcript_path: str | None) -> dict[str, Any]:
    if not transcript_path:
        return {"path": "", "exists": False}
    path = Path(transcript_path).expanduser()
    try:
        stat_result = path.stat()
    except OSError:
        return {"path": str(path), "exists": False}
    return {
        "path": str(path),
        "exists": True,
        "size": stat_result.st_size,
        "mtime_ns": stat_result.st_mtime_ns,
    }


def _skill_outcome_state_root() -> Path:
    plugin_data = os.environ.get("CLAUDE_PLUGIN_DATA") or os.environ.get("GROK_PLUGIN_DATA")
    if plugin_data:
        return Path(plugin_data).expanduser() / "skill-outcomes"
    cache_home = os.environ.get("XDG_CACHE_HOME")
    cache_root = Path(cache_home).expanduser() if cache_home else Path.home() / ".cache"
    return cache_root / "nowledge-mem" / "hook-skill-outcomes"


def _skill_outcome_lock_path(
    payload: dict[str, Any],
    skill_id: str,
    version: str,
) -> Path:
    transcript_path = _payload_value(payload, "transcript_path", "transcriptPath")
    basis = {
        "host": _host_runtime(),
        "session_id": _payload_value(payload, "session_id", "sessionId")
        or os.environ.get("GROK_SESSION_ID", "").strip(),
        "transcript": _transcript_fingerprint(transcript_path),
        "skill_id": skill_id,
        "version": version,
    }
    encoded = json.dumps(basis, sort_keys=True, separators=(",", ":"))
    key = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    return _skill_outcome_state_root() / f"{key}.reported"


def _claim_skill_outcome_report(
    payload: dict[str, Any],
    skill_id: str,
    version: str,
) -> Path | None:
    lock_path = _skill_outcome_lock_path(payload, skill_id, version)
    try:
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return None
    except OSError:
        return lock_path
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(str(time.time()))
        handle.write("\n")
    return lock_path


def _release_skill_outcome_claim(lock_path: Path | None) -> None:
    if lock_path is None:
        return
    try:
        lock_path.unlink()
    except OSError:
        pass


def _report_skill_outcomes(nmem: str, payload: dict[str, Any]) -> None:
    if extract_skill_outcomes_from_file is None or build_outcome_args is None:
        return
    transcript_path = _payload_value(payload, "transcript_path", "transcriptPath")
    outcomes = extract_skill_outcomes_from_file(transcript_path)
    for skill_id, version in outcomes:
        lock_path = _claim_skill_outcome_report(payload, skill_id, version)
        if lock_path is None:
            continue
        command = _build_nmem_command(nmem, *build_outcome_args(skill_id, version))
        try:
            proc = _run_command(command, SKILL_OUTCOME_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            _release_skill_outcome_claim(lock_path)
            print(
                f"nowledge-mem: skill outcome report timed out for {skill_id}@{version}",
                file=sys.stderr,
            )
            continue
        except Exception as exc:
            _release_skill_outcome_claim(lock_path)
            print(
                f"nowledge-mem: skill outcome report failed for {skill_id}@{version}: {exc}",
                file=sys.stderr,
            )
            continue
        if proc.returncode == 0:
            continue
        _release_skill_outcome_claim(lock_path)
        message = (proc.stderr or proc.stdout or "").strip()
        if message:
            print(
                f"nowledge-mem: skill outcome report skipped for {skill_id}@{version}: {message}",
                file=sys.stderr,
            )


def _run_capture_with_retries(
    command: list[str],
    legacy_command: list[str] | None = None,
) -> tuple[bool, int, str]:
    last_returncode = 0
    last_stderr = ""
    start = time.monotonic()

    for delay in SAVE_RETRY_DELAYS_SECONDS:
        if delay:
            time.sleep(delay)

        # Bound the whole loop under the hooks.json 35s kill: give this attempt
        # what is left of the budget, capped at PER_ATTEMPT_TIMEOUT. Stop once
        # there is no meaningful time left rather than starting a doomed attempt.
        remaining = TOTAL_BUDGET_SECONDS - (time.monotonic() - start)
        if remaining <= 1.0:
            break
        attempt_timeout = min(PER_ATTEMPT_TIMEOUT_SECONDS, remaining)

        try:
            proc = _run_command(command, attempt_timeout)
        except subprocess.TimeoutExpired:
            last_returncode = 124
            last_stderr = (
                f"capture attempt timed out after {attempt_timeout:.0f}s"
            )
            continue

        last_returncode = proc.returncode
        last_stderr = (
            proc.stderr
            or (proc.stdout if proc.returncode != 0 else "")
            or ""
        )

        if proc.returncode != 0 and legacy_command and _json_flag_unsupported(proc):
            legacy_remaining = TOTAL_BUDGET_SECONDS - (time.monotonic() - start)
            if legacy_remaining <= 1.0:
                break
            try:
                legacy_proc = _run_command(
                    legacy_command, min(PER_ATTEMPT_TIMEOUT_SECONDS, legacy_remaining)
                )
            except subprocess.TimeoutExpired:
                last_returncode = 124
                last_stderr = "legacy capture attempt timed out"
                continue

            last_returncode = legacy_proc.returncode
            last_stderr = (
                legacy_proc.stderr
                or (legacy_proc.stdout if legacy_proc.returncode != 0 else "")
                or ""
            )
            if legacy_proc.returncode == 0:
                # Older nmem builds may not support --json. In that mode the
                # best compatibility signal is the command's successful exit,
                # matching the pre-0.7.6 hook behavior.
                return True, last_returncode, last_stderr
            continue

        if proc.returncode == 0 and _capture_has_result(proc.stdout or ""):
            return True, last_returncode, last_stderr

    return False, last_returncode, last_stderr


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--event",
        default="hook",
        choices=["pre-compact", "stop", "hook"],
        help="Hook event label used only for diagnostics.",
    )
    args = parser.parse_args()

    nmem = _nmem_command()
    if not nmem:
        print("nowledge-mem: nmem not found; skipped hook capture", file=sys.stderr)
        return 0

    payload = _read_hook_input()
    command = _build_command(nmem, payload, json_output=True)
    legacy_command = _build_command(nmem, payload, json_output=False)

    try:
        captured, returncode, stderr = _run_capture_with_retries(
            command,
            legacy_command,
        )
    except Exception as exc:
        print(f"nowledge-mem: {args.event} capture failed: {exc}", file=sys.stderr)
        return 0

    if returncode != 0:
        message = stderr.strip()
        if message:
            print(f"nowledge-mem: {args.event} capture skipped: {message}", file=sys.stderr)
        return 0

    if not captured:
        print(
            f"nowledge-mem: {args.event} capture skipped: no flushed transcript found",
            file=sys.stderr,
        )
        return 0

    _report_skill_outcomes(nmem, payload)

    if args.event == "pre-compact":
        print(
            f"Nowledge Mem saved the current {_runtime_label(_host_runtime())} thread before compaction."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
