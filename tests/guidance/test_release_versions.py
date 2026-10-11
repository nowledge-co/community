import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGES = {
    "agent-plugins": ("nowledge-mem-agent-plugin", "plugin.json"),
    "alma": ("nowledge-mem-alma-plugin", "manifest.json"),
    "bub": ("nowledge-mem-bub-plugin", "pyproject.toml"),
    "claude-code": ("nowledge-mem-claude-code-plugin", ".claude-plugin/plugin.json"),
    "codex-cli": ("nowledge-mem-codex-plugin", ".codex-plugin/plugin.json"),
    "copilot-cli": ("nowledge-mem-copilot-cli-plugin", ".claude-plugin/plugin.json"),
    "cursor": ("nowledge-mem-cursor-plugin", ".cursor-plugin/plugin.json"),
    "devin": ("nowledge-mem-devin-plugin", ".devin-plugin/plugin.json"),
    "dimagent": ("nowledge-mem-dimagent-plugin", ".codex-plugin/plugin.json"),
    "droid": ("nowledge-mem-droid-plugin", ".factory-plugin/plugin.json"),
    "npx-skills": ("nowledge-mem-npx-skills", None),
    "omp": ("nowledge-mem-omp-plugin", "package.json"),
    "openclaw": ("nowledge-mem-openclaw-plugin", "package.json"),
    "pi": ("nowledge-mem-pi-package", "package.json"),
    "step-code": ("nowledge-mem-step-code", "package.json"),
}


class ReleaseVersions(unittest.TestCase):
    def test_guidance_packages_have_matching_release_metadata(self):
        registry = {item["id"]: item for item in json.loads((ROOT / "integrations.json").read_text(encoding="utf-8"))["integrations"]}
        for identifier, (directory, manifest) in PACKAGES.items():
            with self.subTest(plugin=identifier):
                version = registry[identifier]["version"]
                if manifest:
                    text = (ROOT / directory / manifest).read_text(encoding="utf-8")
                    actual = re.search(r'^version = "([^"]+)"', text, re.M)[1] if manifest.endswith(".toml") else json.loads(text)["version"]
                    self.assertEqual(actual, version)
                changelog = (ROOT / directory / "CHANGELOG.md").read_text(encoding="utf-8")
                self.assertRegex(changelog, rf"(?m)^## \[?{re.escape(version)}\]?(?:\s|$)")
        self.assertEqual(registry["grok"]["version"], registry["claude-code"]["version"])


if __name__ == "__main__":
    unittest.main()
