import importlib.util
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("release", Path(__file__).with_name("plugin-release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_no_downgrade(self):
        release.advances("0.8.10", "0.8.9")
        for version in ("0.8.9", "0.8.8"):
            with self.assertRaises(AssertionError):
                release.advances(version, "0.8.9")

    def test_all_metadata(self):
        registry = json.loads((release.ROOT / "integrations.json").read_text())
        for plugin in release.PACKAGES:
            version = next(x["version"] for x in registry["integrations"] if x["id"] == plugin)
            release.metadata(plugin, version)

    def test_wrong_version_and_unknown_package_fail(self):
        with self.assertRaises(AssertionError):
            release.metadata("bub", "99.0.0")
        with self.assertRaises(KeyError):
            release.metadata("../../elsewhere", "1.0.0")
        with self.assertRaises(ValueError):
            release.metadata("pi", "0.8.9; echo unsafe")

    def test_npm_provenance_requires_matching_public_source(self):
        import shutil
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "nowledge-mem-opencode-plugin"
            shutil.copytree(release.ROOT / package.name, package,
                            ignore=shutil.ignore_patterns("node_modules", "*.tgz"))
            shutil.copyfile(release.ROOT / "integrations.json", root / "integrations.json")
            manifest_path = package / "package.json"
            manifest = json.loads(manifest_path.read_text())
            original = manifest["repository"]
            for repository in ({}, {**original, "url": "https://github.com/other/repo.git"},
                               {**original, "directory": "wrong-package"}):
                manifest["repository"] = repository
                manifest_path.write_text(json.dumps(manifest))
                with self.assertRaises(AssertionError):
                    release.metadata("opencode", manifest["version"], root)

    def test_existing_version_and_non404_fail(self):
        with patch.object(release, "remote", return_value={}):
            with self.assertRaises(RuntimeError):
                release.absent("https://example.invalid")
        for status in (401, 429, 500):
            with patch.object(release, "remote", side_effect=urllib.error.HTTPError("url", status, "", {}, None)):
                with self.assertRaises(urllib.error.HTTPError):
                    release.absent("url")
        with patch.object(release, "remote", side_effect=urllib.error.HTTPError("url", 404, "", {}, None)):
            release.absent("url")

    def test_npm_integrity_and_latest_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pack.json"
            path.write_text(json.dumps([{"name": "pkg", "version": "1.0.0", "integrity": "expected"}]))
            with patch.object(release, "remote", side_effect=[{"dist": {"integrity": "other"}}]):
                with self.assertRaises(AssertionError):
                    release.verify_npm("pkg", "1.0.0", path)
            with patch.object(release, "remote", side_effect=[{"dist": {"integrity": "expected"}}, {"version": "0.9.0"}]):
                with self.assertRaises(AssertionError):
                    release.verify_npm("pkg", "1.0.0", path, attempts=1)
            with patch.object(release, "remote", side_effect=[{"dist": {"integrity": "expected"}}, {"version": "1.0.0"}]):
                release.verify_npm("pkg", "1.0.0", path)

    def test_registry_visibility_waits_without_retrying_writes(self):
        missing = urllib.error.HTTPError("url", 404, "", {}, None)
        with patch.object(release, "remote", side_effect=[missing, {"version": "old"}, {"version": "new"}]) as read:
            with patch.object(release.time, "sleep") as sleep:
                result = release.visible_remote("url", lambda data: data["version"] == "new", attempts=3)
                self.assertEqual(result["version"], "new")
                self.assertEqual(read.call_count, 3)
                self.assertEqual(sleep.call_count, 2)
        with patch.object(release, "remote", side_effect=missing):
            with patch.object(release.time, "sleep") as sleep:
                with self.assertRaises(urllib.error.HTTPError):
                    release.visible_remote("url", attempts=2)
                self.assertEqual(sleep.call_count, 1)
        for status in (401, 403, 429, 500):
            with patch.object(release, "remote", side_effect=urllib.error.HTTPError("url", status, "", {}, None)):
                with patch.object(release.time, "sleep") as sleep:
                    with self.assertRaises(urllib.error.HTTPError):
                        release.visible_remote("url")
                    sleep.assert_not_called()

    def test_pypi_artifact_hashes(self):
        import hashlib
        with tempfile.TemporaryDirectory() as directory:
            files = {}
            for name in ("pkg.whl", "pkg.tar.gz"):
                path = Path(directory) / name
                path.write_bytes(name.encode())
                files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
            response = {"urls": [{"filename": name, "digests": {"sha256": value}} for name, value in files.items()]}
            with patch.object(release, "remote", side_effect=[response, {"info": {"version": "1.0.0"}}]):
                release.verify_pypi("pkg", "1.0.0", directory)
            response["urls"][0]["digests"]["sha256"] = "wrong"
            with patch.object(release, "remote", return_value=response):
                with self.assertRaises(AssertionError):
                    release.verify_pypi("pkg", "1.0.0", directory)

    def test_clawhub_code_plugin_artifact_source_and_latest(self):
        import copy
        pack = {"name": "@nowledge/openclaw-nowledge-mem", "version": "0.8.34",
                "sha256": "expected", "npmIntegrity": "integrity"}
        receipt = {"package": {"name": pack["name"], "family": "code-plugin", "tags": {"latest": "0.8.34"}},
                   "owner": {"handle": "nowledge"},
                   "version": {"version": "0.8.34",
                               "artifact": {"kind": "npm-pack", "sha256": "expected", "npmIntegrity": "integrity"},
                               "verification": {"sourceRepo": "nowledge-co/community", "sourceCommit": "a" * 40,
                                                "sourcePath": "nowledge-mem-openclaw-plugin"}}}
        release.verify_clawhub("0.8.34", pack, receipt, "a" * 40)
        for location, key in (("package", "family"), ("owner", "handle"),
                              ("artifact", "sha256"), ("verification", "sourceCommit")):
            invalid = copy.deepcopy(receipt)
            target = invalid[location] if location in invalid else invalid["version"][location]
            target[key] = "wrong"
            with self.assertRaises(AssertionError):
                release.verify_clawhub("0.8.34", pack, invalid, "a" * 40)
        receipt["package"]["tags"]["latest"] = "old"
        with self.assertRaises(AssertionError):
            release.verify_clawhub("0.8.34", pack, receipt, "a" * 40)

    def test_clawhub_skill_listing_cannot_verify_a_code_plugin(self):
        skill = {"skill": {"slug": "nowledge-mem", "tags": {"latest": "0.8.34"}}}
        with self.assertRaises(KeyError):
            release.verify_clawhub("0.8.34", {}, skill, "a" * 40)


if __name__ == "__main__":
    unittest.main()
