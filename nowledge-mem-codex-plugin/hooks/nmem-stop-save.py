#!/usr/bin/env python3
"""Best-effort Codex transcript capture for Nowledge Mem Stop hooks."""

from __future__ import annotations

import argparse
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
SESSION_NOT_FOUND_MARKERS = (
    "No codex sessions found",
    "Codex sessions directory not found",
    "Make sure Codex has created sessions",
)
JSON_FLAG_UNSUPPORTED_MARKERS = (
    "no such option: --json",
    "unrecognized arguments: --json",
    "unknown option --json",
    "unexpected argument '--json'",
)


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
    for outer_key in ("input", "data", "payload"):
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


def _log_path() -> Path:
    plugin_data = os.environ.get("PLUGIN_DATA") or os.environ.get("CLAUDE_PLUGIN_DATA")
    if plugin_data:
        return Path(plugin_data).expanduser() / "nowledge-mem-stop-hook.log"

    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home).expanduser() / "log" / "nowledge-mem-stop-hook.log"

    return Path.home() / ".codex" / "log" / "nowledge-mem-stop-hook.log"


def _log(message: str) -> None:
    try:
        path = _log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with path.open("a", encoding="utf-8") as handle:
            handle.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


def _nmem_command() -> str | None:
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
        return [
            "cmd.exe",
            "/s",
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
                # Older nmem builds may not support --json. In that mode the
                # best compatibility signal is the command's successful exit,
                # matching the pre-0.1.10 hook behavior.
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
