#!/usr/bin/env python3
"""Shared cross-platform process helpers for Codex lifecycle hooks."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


def windows_no_window_kwargs() -> dict[str, int]:
    if sys.platform != "win32":
        return {}
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)}


def find_nmem_command() -> str | None:
    return shutil.which("nmem") or shutil.which("nmem.cmd")


def cmd_exe_path(path: str) -> str:
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
                    encoding="utf-8",
                    errors="replace",
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


def build_nmem_command(nmem: str, *args: str) -> list[str]:
    if nmem.lower().endswith((".cmd", ".bat")):
        command = subprocess.list2cmdline([cmd_exe_path(nmem), *args])
        if os.name == "nt":
            return [os.environ.get("COMSPEC", "cmd.exe"), "/d", "/s", "/c", command]
        return ["cmd.exe", "/d", "/s", "/c", command]
    return [nmem, *args]
