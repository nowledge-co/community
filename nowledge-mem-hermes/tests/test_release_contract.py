"""Keep the installable provider and the update registry on one release."""

import json
from pathlib import Path


def test_hermes_manifest_matches_registry_and_documented_release():
    plugin = Path(__file__).resolve().parents[1]
    manifest = (plugin / "plugin.yaml").read_text(encoding="utf-8")
    version = next(
        line.removeprefix("version:").strip()
        for line in manifest.splitlines()
        if line.startswith("version:")
    )
    registry = json.loads(
        (plugin.parent / "integrations.json").read_text(encoding="utf-8")
    )
    hermes = next(item for item in registry["integrations"] if item["id"] == "hermes")
    assert version == "0.5.24"
    assert hermes["version"] == version
    assert f"## [{version}]" in (plugin / "CHANGELOG.md").read_text(encoding="utf-8")
    assert version in (plugin / "README.md").read_text(encoding="utf-8")
