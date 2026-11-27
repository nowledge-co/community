"""Render the qualified Codex marketplace from a reviewed tree; never push a ref."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY_SHA = "e52328644bd95c489c35c73ef03cc3677c226316"
MARKET = Path(".agents/plugins/marketplace.json")

def render(root):
    doc = json.loads((root / MARKET).read_text(encoding="utf8"))
    [entry] = [plugin for plugin in doc["plugins"] if plugin["name"] == "nowledge-mem"]
    legacy = {"source": "git-subdir", "url": "https://github.com/nowledge-co/community.git",
              "path": "nowledge-mem-codex-plugin", "sha": LEGACY_SHA}
    if entry["source"] != legacy:
        raise ValueError("expected the immutable legacy Codex source; inspect the catalog before release")
    [row] = [item for item in json.loads((root / "integrations.json").read_text(encoding="utf8"))["integrations"]
             if item["id"] == "codex-cli"]
    offer = row["followWorkspaceRelease"]
    manifest = json.loads((root / row["directory"] / ".codex-plugin/plugin.json").read_text(encoding="utf8"))
    if offer["version"] != manifest["version"] or offer["marketplaceRef"] != "codex-workspace":
        raise ValueError("qualified Codex receipt does not match catalog")
    entry["source"] = {"source": "local", "path": "./" + row["directory"]}
    return json.dumps(doc, indent=2) + "\n"

if __name__ == "__main__":
    sys.stdout.write(render(ROOT))
