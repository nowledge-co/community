from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    manifest = read_json(ROOT / ".codex-plugin" / "plugin.json")
    skill = (ROOT / "skills" / "nowledge-mem" / "SKILL.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    submission = (ROOT / "SUBMISSION.md").read_text(encoding="utf-8")
    finalizer = ROOT / "scripts" / "finalize-app-connection.mjs"

    assert manifest["name"] == "nowledge-mem-cloud"
    assert manifest["skills"] == "./skills/"
    assert "apps" not in manifest
    assert not (ROOT / ".app.json").exists()
    assert "plugin_asdk_app_" not in json.dumps(manifest)
    assert "never ask the user to paste a Nowledge API key" in skill
    assert "does not let Mem read the host's private transcript" in skill
    assert "does not replace `nowledge-mem-codex-plugin`" in readme
    assert "Never substitute a guessed ID" in submission

    with tempfile.TemporaryDirectory(prefix="nmem-openai-plugin-") as temp:
        probe = Path(temp) / ROOT.name
        shutil.copytree(ROOT, probe)
        rejected = subprocess.run(
            ["node", str(probe / "scripts" / finalizer.name), "plugin_asdk_app_TODO"],
            text=True,
            capture_output=True,
            check=False,
        )
        assert rejected.returncode == 2
        accepted_id = "plugin_asdk_app_" + ("0123456789abcdef" * 2)
        subprocess.run(
            ["node", str(probe / "scripts" / finalizer.name), accepted_id],
            text=True,
            capture_output=True,
            check=True,
        )
        assert read_json(probe / ".app.json") == {
            "apps": {"nowledge-mem": {"id": accepted_id}}
        }
        assert read_json(probe / ".codex-plugin" / "plugin.json")["apps"] == "./.app.json"

    print("openai plugin package: PASS")


if __name__ == "__main__":
    main()
