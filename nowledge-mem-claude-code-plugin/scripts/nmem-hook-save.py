#!/usr/bin/env python3
"""Best-effort Claude Code transcript capture for Nowledge Mem hooks."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


ATTEMPT_TIMEOUT_SECONDS = 8
SAVE_RETRY_DELAYS_SECONDS = (0.0, 0.5, 1.5, 3.0)
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


def _build_command(
    nmem: str,
    payload: dict[str, Any],
    *,
    json_output: bool = True,
) -> list[str]:
    args = (["--json"] if json_output else []) + [
        "t",
        "save",
        "--from",
        "claude-code",
        "--truncate",
    ]

    session_id = _payload_value(payload, "session_id", "sessionId")
    if session_id:
        args.extend(["--session-id", session_id])

    cwd = _payload_value(payload, "cwd")
    if cwd:
        project_path = Path(cwd).expanduser()
        project = str(project_path if nmem.lower().endswith(".cmd") else project_path.resolve())
        if nmem.lower().endswith(".cmd"):
            project = _cmd_exe_path(project)
        args.extend(["--project", project])

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


def _run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=ATTEMPT_TIMEOUT_SECONDS,
    )


def _run_capture_with_retries(
    command: list[str],
    legacy_command: list[str] | None = None,
) -> tuple[bool, int, str]:
    last_returncode = 0
    last_stderr = ""

    for delay in SAVE_RETRY_DELAYS_SECONDS:
        if delay:
            time.sleep(delay)

        try:
            proc = _run_command(command)
        except subprocess.TimeoutExpired:
            last_returncode = 124
            last_stderr = (
                f"capture attempt timed out after {ATTEMPT_TIMEOUT_SECONDS}s"
            )
            continue

        last_returncode = proc.returncode
        last_stderr = proc.stderr or ""

        if proc.returncode != 0 and legacy_command and _json_flag_unsupported(proc):
            try:
                legacy_proc = _run_command(legacy_command)
            except subprocess.TimeoutExpired:
                last_returncode = 124
                last_stderr = (
                    f"legacy capture attempt timed out after {ATTEMPT_TIMEOUT_SECONDS}s"
                )
                continue

            last_returncode = legacy_proc.returncode
            last_stderr = legacy_proc.stderr or ""
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

    if args.event == "pre-compact":
        print(
            "Nowledge Mem saved the current Claude Code thread before compaction."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
