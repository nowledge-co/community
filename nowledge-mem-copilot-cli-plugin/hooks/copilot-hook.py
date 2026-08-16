#!/usr/bin/env python3
"""Cross-shell Copilot CLI hook entry point for Nowledge Mem.

Copilot CLI runs hook command strings through the host shell. On Windows that
can be PowerShell, so hooks.json must not contain POSIX shell functions or
conditionals. This file owns the logic; the shell only starts Python.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


NMEM_TIMEOUT_SECS = 30


def windows_no_window_kwargs() -> dict[str, int]:
    if sys.platform != "win32":
        return {}
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)}


def build_nmem_command(nmem_bin: str, *args: str) -> list[str]:
    if nmem_bin.lower().endswith(".cmd"):
        return ["cmd.exe", "/d", "/c", "call", nmem_bin, *args]
    return [nmem_bin, *args]


def nmem_bin() -> str | None:
    return shutil.which("nmem") or shutil.which("nmem.cmd")


def run_json(nmem: str, *args: str) -> dict:
    proc = subprocess.run(
        build_nmem_command(nmem, *args),
        capture_output=True,
        text=True,
        timeout=NMEM_TIMEOUT_SECS,
        **windows_no_window_kwargs(),
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "command failed")
    output = proc.stdout.strip()
    return json.loads(output) if output else {}


def append_scope_args(args: list[str]) -> list[str]:
    agent_id = os.environ.get("NMEM_AGENT_ID", "").strip()
    host_agent_id = os.environ.get("NMEM_HOST_AGENT_ID", "").strip()
    space = os.environ.get("NMEM_SPACE", "").strip() or os.environ.get("NMEM_SPACE_ID", "").strip()
    if agent_id:
        args.extend(["--agent-id", agent_id])
    if host_agent_id:
        args.extend(["--host-agent-id", host_agent_id])
    if space:
        args.extend(["--space", space])
    return args


def read_context() -> str:
    nmem = nmem_bin()
    if nmem:
        try:
            payload = run_json(
                nmem,
                *append_scope_args(["--json", "context", "--source-app", "copilot-cli"]),
            )
            content = (
                payload.get("rendered_markdown")
                or payload.get("markdown")
                or payload.get("content")
                or ""
            )
            if content:
                return str(content)
        except Exception:
            pass
        try:
            payload = run_json(nmem, "--json", "wm", "read")
            content = payload.get("content") or ""
            if content:
                return str(content)
        except Exception:
            pass

    fallback = Path.home() / "ai-now" / "memory.md"
    try:
        return fallback.read_text(encoding="utf-8")
    except Exception:
        return ""


def run_capture(event: str, raw_stdin: str) -> int:
    script = Path(__file__).with_name("copilot-stop-save.py")
    if not script.exists():
        return 0
    proc = subprocess.run(
        [sys.executable, str(script), "--event", event],
        input=raw_stdin,
        text=True,
        **windows_no_window_kwargs(),
    )
    return proc.returncode


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default="")
    args, _unknown = parser.parse_known_args()
    event = (args.event or "").strip().lower()
    raw = sys.stdin.read()

    if event in {"session-start", "compact"}:
        content = read_context()
        if content:
            print(content)
        if event == "compact":
            print(
                "\n---\nContext was compacted. If you discovered important insights, "
                "save them before continuing:\n  nmem m add \"<insight>\" "
                "--title \"<short title>\" --importance 0.8"
            )
        return 0

    if event == "user-prompt-submit":
        if nmem_bin():
            print(
                "[Nowledge Mem] Search proactively when past knowledge would help: "
                "nmem --json m search \"query\". Save decisions and learnings "
                "autonomously: nmem m add \"content\" -t \"Title\" -i 0.8"
            )
        return 0

    if event in {"stop", "pre-compact", "session-end"}:
        return run_capture(event, raw)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
