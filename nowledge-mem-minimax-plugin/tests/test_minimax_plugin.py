import json
import stat
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    manifest_path = ROOT / ".minimax-plugin" / "plugin.json"
    mcp_path = ROOT / "nowledge-mem-local.mcp.json"
    readme_path = ROOT / "README.md"
    skill_path = ROOT / "skills" / "nowledge-mem" / "SKILL.md"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    mcp = json.loads(mcp_path.read_text(encoding="utf-8"))
    readme = readme_path.read_text(encoding="utf-8")
    skill = skill_path.read_text(encoding="utf-8")

    assert manifest["name"] == "nowledge-mem"
    assert manifest["displayName"] == "Nowledge Mem"
    assert manifest["version"] == "0.1.1"
    assert manifest["icon"] == "icon.png"
    assert manifest["mcpServers"] == ["nowledge-mem-local.mcp.json"]
    assert mcp["mcpServers"]["nowledge-mem"]["type"] == "streamable-http"
    assert mcp["mcpServers"]["nowledge-mem"]["url"] == "http://127.0.0.1:14242/mcp"
    assert "Available only after MiniMax Marketplace App approval and provider configuration" in readme
    assert "does not have a verified MiniMax transcript or lifecycle hook" in skill
    assert "Do not claim that it automatically captures" in skill

    execute_mask = stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
    for path in ROOT.rglob("*"):
        if path.is_file():
            assert not (path.stat().st_mode & execute_mask), path

    print("minimax plugin package: PASS")


if __name__ == "__main__":
    main()
