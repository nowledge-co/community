import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    manifest_path = ROOT / ".codex-plugin" / "plugin.json"
    mcp_path = ROOT / ".mcp.json"
    manifest = json.loads(manifest_path.read_text())
    mcp = json.loads(mcp_path.read_text())

    assert manifest["name"] == "nowledge-mem-openai"
    assert manifest["version"] == "0.1.0"
    assert manifest["skills"] == "./skills/"
    assert manifest["mcpServers"] == "./.mcp.json"
    assert mcp["mcpServers"]["nowledge-mem"]["type"] == "streamable-http"
    assert mcp["mcpServers"]["nowledge-mem"]["url"] == "https://cloud.nowledge.co/mcp"

    package_text = "\n".join(
        path.read_text(errors="replace")
        for path in ROOT.rglob("*")
        if path.is_file() and ".git" not in path.parts and "tests" not in path.parts
    )
    for forbidden in ("127.0.0.1", "localhost", "Authorization: Bearer", "api_key"):
        assert forbidden not in package_text, forbidden
    assert "automatic full-thread capture" in (ROOT / "README.md").read_text()
    print("openai plugin package: PASS")


if __name__ == "__main__":
    main()
