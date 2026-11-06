"""Exercise the PR guard against real Git trees, including non-runtime files."""

import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[2] / "scripts/check_codex_bundle_version.py"
SPEC = importlib.util.spec_from_file_location("bundle_version", SCRIPT)
GUARD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GUARD)


class BundleVersionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.git("init", "--quiet")
        self.bundle = self.root / GUARD.BUNDLE
        self.manifest = self.root / GUARD.MANIFEST
        self.manifest.parent.mkdir(parents=True)
        self.write_version("0.1.47")
        self.base = self.commit()

    def git(self, *arguments):
        return subprocess.check_output([
            "git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.com",
            "-c", "commit.gpgsign=false", *arguments,
        ], cwd=self.root, text=True).strip()

    def commit(self):
        self.git("add", ".")
        self.git("commit", "--quiet", "-m", "Update fixture")
        return self.git("rev-parse", "HEAD")

    def write_version(self, version):
        self.manifest.write_text(json.dumps({"version": version}), encoding="utf-8")

    def test_every_shipped_file_requires_a_new_version(self):
        for relative in ("README.md", "tests/fixture.py", "skills/bridge/SKILL.md"):
            with self.subTest(file=relative):
                target = self.bundle / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("Changed content\n", encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "without a version increase"):
                    GUARD.check_versions(self.base, self.commit(), self.root)

    def test_version_increase_admits_bundle_changes(self):
        (self.bundle / "README.md").write_text("Changed content\n", encoding="utf-8")
        self.write_version("0.1.48")
        GUARD.check_versions(self.base, self.commit(), self.root)

    def test_downgrade_is_rejected(self):
        self.write_version("0.1.46")
        with self.assertRaisesRegex(ValueError, "without a version increase"):
            GUARD.check_versions(self.base, self.commit(), self.root)

    def test_unrelated_changes_need_no_codex_version(self):
        (self.root / "other.txt").write_text("Unrelated content\n", encoding="utf-8")
        GUARD.check_versions(self.base, self.commit(), self.root)


if __name__ == "__main__":
    unittest.main()
