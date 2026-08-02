from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]


def _load_client_module():
    package_name = "nowledge_mem_hermes_installer_contract"
    if package_name not in sys.modules:
        package = type(sys)(package_name)
        package.__path__ = [str(PLUGIN_ROOT)]
        sys.modules[package_name] = package
    spec = importlib.util.spec_from_file_location(
        f"{package_name}.client",
        PLUGIN_ROOT / "client.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_powershell_web_installer_is_ascii_without_bom() -> None:
    installer = PLUGIN_ROOT / "setup.ps1"
    source = installer.read_bytes()

    assert not source.startswith(b"\xef\xbb\xbf"), "setup.ps1 must not contain a UTF-8 BOM"
    non_ascii = [(offset, value) for offset, value in enumerate(source) if value > 0x7F]
    assert not non_ascii, (
        "setup.ps1 must remain ASCII-only for Windows PowerShell 5.1 irm | iex; "
        f"first non-ASCII bytes: {non_ascii[:8]}"
    )


def test_resolve_nmem_honors_explicit_cli_path_when_path_is_reduced(monkeypatch, tmp_path: Path) -> None:
    client = _load_client_module()
    exe = tmp_path / "nmem"
    exe.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    exe.chmod(0o755)

    monkeypatch.setenv("PATH", "")
    monkeypatch.setenv("NMEM_CLI_PATH", str(exe))

    assert client._resolve_nmem() == str(exe)


def test_resolve_nmem_finds_common_user_bin_when_path_is_reduced(monkeypatch, tmp_path: Path) -> None:
    client = _load_client_module()
    home = tmp_path / "home"
    exe = home / ".local" / "bin" / "nmem"
    exe.parent.mkdir(parents=True)
    exe.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    exe.chmod(0o755)

    monkeypatch.setenv("PATH", "")
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.delenv("NMEM_CLI_PATH", raising=False)
    monkeypatch.delenv("NMEM_BIN", raising=False)
    monkeypatch.delenv("NMEM_CLI", raising=False)
    monkeypatch.setattr(client.sys, "platform", "darwin")
    monkeypatch.setattr(client.os, "name", "posix", raising=False)

    assert client._resolve_nmem() == str(exe)
