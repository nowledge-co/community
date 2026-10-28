import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGES = {
    "agent-plugins": ("nowledge-mem-agent-plugin", "plugin.json"),
    "alma": ("nowledge-mem-alma-plugin", "manifest.json"),
    "bub": ("nowledge-mem-bub-plugin", "pyproject.toml"),
    "cherry-studio": ("nowledge-mem-cherry-studio", "pyproject.toml"),
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
    "workbuddy": ("nowledge-mem-workbuddy-plugin", ".workbuddy-plugin/plugin.json"),
}

# Additional release-bearing surfaces, excluding dependency/compatibility versions.
EXTRA_SURFACES = {
    "workbuddy": [(".workbuddy-plugin/marketplace.json", ("plugins", 0, "version"))],
    "alma": [("nowledge-mem-alma-plugin/package.json", ("version",))],
    "openclaw": [
        ("nowledge-mem-openclaw-plugin/openclaw.plugin.json", ("version",)),
        ("nowledge-mem-openclaw-plugin/package-lock.json", ("version",)),
        ("nowledge-mem-openclaw-plugin/package-lock.json", ("packages", "", "version")),
    ],
    "claude-code": [(".claude-plugin/marketplace.json", ("plugins", 0, "version"))],
    "copilot-cli": [(".github/plugin/marketplace.json", ("plugins", 0, "version"))],
}
RUNTIME_SURFACES = {
    "pi": ("nowledge-mem-pi-package/extensions/nowledge-mem.ts", "DEFAULT_PLUGIN_VERSION"),
    "omp": ("nowledge-mem-omp-plugin/extensions/nowledge-mem.ts", r"process\.env\.NMEM_PLUGIN_VERSION"),
    "step-code": ("nowledge-mem-step-code/extensions/nowledge-mem.ts", r"process\.env\.NMEM_PLUGIN_VERSION"),
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
                for path, keys in EXTRA_SURFACES.get(identifier, []):
                    with self.subTest(surface=path, keys=keys):
                        actual = json.loads((ROOT / path).read_text(encoding="utf-8"))
                        for key in keys:
                            actual = actual[key]
                        self.assertEqual(actual, version)
                if identifier in RUNTIME_SURFACES:
                    path, constant = RUNTIME_SURFACES[identifier]
                    text = (ROOT / path).read_text(encoding="utf-8")
                    match = re.search(rf'{constant}\s*=\s*"([^"]+)"', text)
                    self.assertIsNotNone(match, path)
                    self.assertEqual(match[1], version, path)
        self.assertEqual(registry["grok"]["version"], registry["claude-code"]["version"])


if __name__ == "__main__":
    unittest.main()
