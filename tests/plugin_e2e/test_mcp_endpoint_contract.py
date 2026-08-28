from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


COMMUNITY_ROOT = Path(__file__).resolve().parents[2]
TEXT_SUFFIXES = {
    ".cjs",
    ".cts",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".mts",
    ".ps1",
    ".py",
    ".sh",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
class McpEndpointContractTest(unittest.TestCase):
    def test_active_artifacts_do_not_emit_the_legacy_trailing_slash_route(self) -> None:
        legacy_route = "/mcp" + "/"
        legacy_fixture_markers = {
            "nowledge-mem-codex-plugin/tests/test_codex_plugin.py": (
                "https://user.example" + legacy_route,
                "https://old.example" + legacy_route,
            ),
            "nowledge-mem-hermes/CHANGELOG.md": (
                "http://127.0.0.1:14242" + legacy_route,
            ),
            "nowledge-mem-langgraph/tests/test_connector.py": (
                "https://cloud.nowledge.co" + legacy_route,
            ),
        }
        unexpected: list[str] = []
        repository_files = subprocess.run(
            [
                "git",
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
            ],
            cwd=COMMUNITY_ROOT,
            check=True,
            capture_output=True,
        ).stdout.decode("utf-8").split("\0")

        for relative in repository_files:
            path = COMMUNITY_ROOT / relative
            if not relative or path.suffix not in TEXT_SUFFIXES:
                continue
            lines = path.read_text(encoding="utf-8").splitlines()
            for line_number, line in enumerate(lines, 1):
                if legacy_route not in line:
                    continue
                allowed_markers = legacy_fixture_markers.get(relative, ())
                if any(marker in line for marker in allowed_markers):
                    continue
                unexpected.append(f"{relative}:{line_number}")

        self.assertEqual(
            [],
            unexpected,
            "active connector artifacts must use the exact /mcp route",
        )


if __name__ == "__main__":
    unittest.main()
