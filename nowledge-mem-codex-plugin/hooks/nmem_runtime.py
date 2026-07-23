#!/usr/bin/env python3
"""Shared cross-platform process helpers for Codex lifecycle hooks."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


def _is_wsl() -> bool:
    return bool(os.environ.get("WSL_DISTRO_NAME") or os.environ.get("WSL_INTEROP"))


def _usable_command(candidate: str | Path | None) -> str | None:
    if candidate is None:
        return None
    value = os.path.expandvars(os.path.expanduser(str(candidate).strip()))
    if not value:
        return None
    path = Path(value)
    try:
        if not path.is_file():
            return None
    except OSError:
        return None
    if os.name == "nt" or path.suffix.lower() in (".cmd", ".bat", ".exe"):
        return str(path)
    return str(path) if os.access(path, os.X_OK) else None


def _windows_cmd_command() -> str | None:
    discovered = shutil.which("cmd.exe")
    if discovered:
        return discovered
    if _is_wsl():
        return _usable_command("/mnt/c/Windows/System32/cmd.exe")
    return None


def _windows_path_to_wsl(path: str) -> Path | None:
    value = path.strip().strip('"')
    if len(value) < 3 or value[1] != ":" or value[2] not in ("\\", "/"):
        return None
    drive = value[0].lower()
    suffix = value[3:].replace("\\", "/")
    return Path("/mnt") / drive / suffix


def _wsl_windows_local_app_data() -> Path | None:
    if not _is_wsl():
        return None
    cmd = _windows_cmd_command()
    if not cmd:
        return None
    try:
        proc = subprocess.run(
            [cmd, "/d", "/s", "/c", "echo(%LOCALAPPDATA%"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=2,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    return _windows_path_to_wsl(proc.stdout.strip())


def _known_nmem_candidates() -> list[Path]:
    home = Path.home()
    candidates = [
        home / ".local" / "share" / "nowledge-mem" / "bin" / "nmem-wrapper",
        Path("/usr/local/bin/nmem"),
        home / ".local" / "bin" / "nmem",
        Path("/opt/homebrew/bin/nmem"),
        Path("/usr/bin/nmem"),
    ]

    local_app_data = os.environ.get("LOCALAPPDATA", "").strip()
    if local_app_data:
        root = Path(local_app_data)
        candidates.extend(
            [
                root / "Nowledge Mem CLI" / "bin" / "nmem.cmd",
                root / "Programs" / "Nowledge Mem" / "cli" / "nmem.cmd",
                root / "Nowledge Mem" / "cli" / "nmem.cmd",
            ]
        )

    for env_name in ("PROGRAMFILES", "PROGRAMW6432", "PROGRAMFILES(X86)"):
        program_files = os.environ.get(env_name, "").strip()
        if program_files:
            candidates.append(Path(program_files) / "Nowledge Mem" / "cli" / "nmem.cmd")

    app_data = os.environ.get("APPDATA", "").strip()
    if app_data:
        candidates.append(Path(app_data) / "npm" / "nmem.cmd")

    wsl_local_app_data = _wsl_windows_local_app_data()
    if wsl_local_app_data:
        candidates.extend(
            [
                wsl_local_app_data / "Nowledge Mem CLI" / "bin" / "nmem.cmd",
                wsl_local_app_data / "Nowledge Mem" / "cli" / "nmem.cmd",
            ]
        )
    return candidates


def windows_no_window_kwargs() -> dict[str, int]:
    if sys.platform != "win32":
        return {}
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)}


def find_nmem_command() -> str | None:
    configured = os.environ.get("NMEM_CLI_PATH", "").strip()
    if configured:
        resolved = shutil.which(configured) or _usable_command(configured)
        if resolved:
            return resolved

    for name in ("nmem", "nmem.cmd", "nmem.exe"):
        resolved = shutil.which(name)
        if resolved:
            return resolved

    seen: set[str] = set()
    for candidate in _known_nmem_candidates():
        key = os.path.normcase(str(candidate))
        if key in seen:
            continue
        seen.add(key)
        resolved = _usable_command(candidate)
        if resolved:
            return resolved
    return None


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
        if os.name == "nt":
            return [nmem, *args]
        command = subprocess.list2cmdline([cmd_exe_path(nmem), *args])
        return [_windows_cmd_command() or "cmd.exe", "/d", "/s", "/c", command]
    return [nmem, *args]
