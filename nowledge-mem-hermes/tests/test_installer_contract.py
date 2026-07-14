from __future__ import annotations

from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]


def test_powershell_web_installer_is_ascii_without_bom() -> None:
    installer = PLUGIN_ROOT / "setup.ps1"
    source = installer.read_bytes()

    assert not source.startswith(b"\xef\xbb\xbf"), "setup.ps1 must not contain a UTF-8 BOM"
    non_ascii = [(offset, value) for offset, value in enumerate(source) if value > 0x7F]
    assert not non_ascii, (
        "setup.ps1 must remain ASCII-only for Windows PowerShell 5.1 irm | iex; "
        f"first non-ASCII bytes: {non_ascii[:8]}"
    )
