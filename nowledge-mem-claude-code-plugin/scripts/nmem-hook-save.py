#!/usr/bin/env python3
"""Best-effort Claude Code transcript capture for Nowledge Mem hooks."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


TIMEOUT_SECONDS = 30


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


def _build_command(nmem: str, payload: dict[str, Any]) -> list[str]:
    args = ["t", "save", "--from", "claude-code", "--truncate"]

    session_id = _payload_value(payload, "session_id", "sessionId")
    if session_id:
        args.extend(["--session-id", session_id])

    cwd = _payload_value(payload, "cwd")
    if cwd:
        project = str(Path(cwd).expanduser())
        if nmem.lower().endswith(".cmd"):
            project = _cmd_exe_path(project)
        args.extend(["--project", project])

    return _build_nmem_command(nmem, *args)


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
    command = _build_command(nmem, payload)

    try:
        proc = subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        print(
            f"nowledge-mem: {args.event} capture timed out after {TIMEOUT_SECONDS}s",
            file=sys.stderr,
        )
        return 0
    except Exception as exc:
        print(f"nowledge-mem: {args.event} capture failed: {exc}", file=sys.stderr)
        return 0

    if proc.returncode != 0:
        message = (proc.stderr or "").strip()
        if message:
            print(f"nowledge-mem: {args.event} capture skipped: {message}", file=sys.stderr)
        return 0

    if args.event == "pre-compact":
        print(
            "Nowledge Mem saved the current Claude Code thread before compaction."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
