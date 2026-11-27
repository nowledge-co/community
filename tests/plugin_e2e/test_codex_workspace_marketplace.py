"""The same marketplace/plugin identity has two non-overlapping delivery paths."""
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def test_old_update_offer_stays_compatible_and_qualified_ref_loads_current_package():
    registry = json.loads((ROOT / "integrations.json").read_text())
    [row] = [item for item in registry["integrations"] if item["id"] == "codex-cli"]
    assert row["version"] == "0.1.55"
    offer = row["followWorkspaceRelease"]
    assert offer["minimumNmemVersion"] == "0.10.126"
    render = runpy.run_path(str(ROOT / "scripts/render_codex_workspace_marketplace.py"))["render"]
    legacy = json.loads((ROOT / ".agents/plugins/marketplace.json").read_text())
    following = json.loads(render(ROOT))
    old = next(item for item in legacy["plugins"] if item["name"] == "nowledge-mem")
    new = next(item for item in following["plugins"] if item["name"] == "nowledge-mem")
    assert old["source"]["sha"] == "788484c84144e5f4f79f161f3838a92659992c8a"
    assert following["name"] == legacy["name"] and new["source"] == {"source":"local", "path":"./nowledge-mem-codex-plugin"}
    new["source"] = old["source"]
    assert legacy == following


def test_optional_stdio_install_does_not_replace_existing_explicit_http_consumers():
    for name, app, var in (("dim","Dim","NMEM_MCP_URL"), ("openhands","OpenHands","NMEM_API_URL")):
        pkg = ROOT / f"nowledge-mem-{name}-plugin"
        http = json.loads((pkg/"mcp.json").read_text())["mcpServers"]["nowledge-mem"]
        assert http["type"] == "http" and var in http["url"]
        cli = json.loads((pkg/"mcp.stdio.json").read_text())["mcpServers"]["nowledge-mem"]
        assert cli == {"type":"stdio", "command":"nmem", "args":["mcp"], "env":{"NMEM_MCP_APP":app}}
