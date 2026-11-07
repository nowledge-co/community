"""Packaging proof, distinct from real-host natural-language acceptance."""
import json
from pathlib import Path
import re
import shutil
import tempfile
import unittest

PLUGIN_ROOT = Path(__file__).resolve().parent.parent


class BridgePackageTests(unittest.TestCase):
    def test_standalone_native_session_reference_stays_inside_the_package(self):
        with tempfile.TemporaryDirectory() as root:
            installed = Path(root) / "package"
            shutil.copytree(PLUGIN_ROOT, installed, symlinks=True)
            manifest = json.loads(
                (installed / ".codex-plugin/plugin.json").read_text(encoding="utf-8")
            )
            skill = installed / manifest["skills"] / "bridge/SKILL.md"
            references = re.findall(
                r"\[[^\]]+\]\((references/[^)]+)\)",
                skill.read_text(encoding="utf-8"),
            )
            self.assertTrue(references, "native guidance must ship with the skill")
            for target in references:
                reference = skill.parent / target
                self.assertTrue(reference.is_file(), target)
                self.assertFalse(reference.is_symlink(), target)
                reference.resolve().relative_to(installed.resolve())
                content = reference.read_text(encoding="utf-8")
                self.assertNotIn("/Users/", content)
                self.assertNotIn("nowledge-co/mem/issues/", content)

    def test_standalone_install_exposes_bridge_through_declared_skill_root(self):
        registry = json.loads((PLUGIN_ROOT.parent / "integrations.json").read_text(encoding="utf-8"))
        entries = registry["integrations"]
        codex = next(entry for entry in entries if entry["id"] == "codex-cli")
        self.assertIn("bridge", codex["skills"])
        with tempfile.TemporaryDirectory() as root:
            installed = Path(root) / "package"
            shutil.copytree(PLUGIN_ROOT, installed, symlinks=True)
            manifest = json.loads((installed / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
            self.assertEqual(codex["version"], manifest["version"])
            skills_root = installed / manifest["skills"]
            skill = skills_root / "bridge/SKILL.md"
            self.assertTrue(skill.is_file(), "installed discovery must not need the source checkout")
            for path in (skills_root, skill.parent, skill):
                self.assertFalse(path.is_symlink(), str(path))
            frontmatter = skill.read_text(encoding="utf-8").split("---", 2)[1]
            self.assertIn("name: bridge", frontmatter)
            self.assertRegex(frontmatter, r"(?m)^description: .+Bridge.+")
            for name in codex["skills"]:
                self.assertTrue((skills_root / name / "SKILL.md").is_file(), name)
            for document in (skill, installed / "AGENTS.md"):
                self.assertNotIn("/Users/", document.read_text(encoding="utf-8"))
                self.assertNotIn("nowledge-co/mem/issues/", document.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
