"""Opt-in real-host recall test with a hermetic CLI instead of a live Mem server."""

import json
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

import pytest

PLUGIN_ROOT = Path(__file__).parent.parent


@pytest.mark.skipif(
    os.environ.get("NMEM_E2E_CLAUDE_RECALL") != "1",
    reason="Real Claude recall smoke is opt-in",
)
def test_claude_searches_prior_decision_and_uses_retrieved_answer(tmp_path):
    claude = shutil.which("claude")
    if not claude:
        pytest.skip("Claude Code is not installed")
    if os.name == "nt":
        pytest.skip("This opt-in fake-CLI host smoke uses a POSIX executable")
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    marker = "recall-project-" + uuid.uuid4().hex[:12]
    chosen_option = "choice-" + uuid.uuid4().hex
    calls = tmp_path / "calls.jsonl"
    cli = bin_dir / "nmem"
    cli.write_text(
        f"#!{sys.executable}\n"
        "import json, sys\n"
        f"with open({str(calls)!r}, 'a') as record:\n"
        "    record.write(json.dumps(sys.argv[1:]) + '\\n')\n"
        "args = [arg for arg in sys.argv[1:] if arg != '--json']\n"
        "if args[:1] == ['context']:\n"
        "    response = {'rendered_markdown': 'Active Space: Recall Test. Startup briefing has no project decisions.'}\n"
        "elif args[:2] in (['m', 'search'], ['memories', 'search']):\n"
        f"    response = {{'memories': [{{'id': 'recall-fixture', 'title': {marker!r}, 'content': 'The agreed design option is {chosen_option}.', 'score': 1.0}}]}}\n"
        "elif args[:2] in (['m', 'get'], ['memories', 'get']):\n"
        f"    response = {{'id': 'recall-fixture', 'content': 'The agreed design option is {chosen_option}.'}}\n"
        "else:\n"
        "    response = {'success': True, 'exists': False, 'threads': []}\n"
        "print(json.dumps(response))\n",
        encoding="utf-8",
    )
    cli.chmod(0o755)
    environment = os.environ.copy()
    for name in tuple(environment):
        if name.startswith(("NMEM_", "GROK_", "WSL_")):
            environment.pop(name)
    environment.update(
        {
            "PATH": str(bin_dir) + os.pathsep + environment.get("PATH", ""),
            "NMEM_CLI_PATH": str(cli),
            "NMEM_SPACE": "Recall Test",
            "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1",
        }
    )
    command = [
        claude,
        "-p",
        f"Continue the design for {marker} using the option we agreed on last time. What was the exact option identifier?",
        "--plugin-dir",
        str(PLUGIN_ROOT),
        "--setting-sources",
        "",
        "--settings",
        '{"enabledPlugins":{},"autoMemoryEnabled":false}',
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--tools",
        "Bash,Skill",
        "--allowedTools",
        "Bash,Skill",
        "--permission-mode",
        "dontAsk",
        "--output-format",
        "stream-json",
        "--include-hook-events",
        "--verbose",
        "--max-budget-usd",
        os.environ.get("NMEM_E2E_CLAUDE_RECALL_MAX_BUDGET_USD", "0.50"),
        "--model",
        os.environ.get("NMEM_E2E_CLAUDE_MODEL", "haiku"),
    ]
    result = subprocess.run(
        command,
        cwd=workspace,
        env=environment,
        text=True,
        capture_output=True,
        timeout=180,
        check=False,
    )
    events = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
    final = next(
        (event for event in reversed(events) if event.get("type") == "result"), {}
    )
    assert result.returncode == 0, (
        f"Claude failed: {final.get('subtype')} {result.stderr[-1000:]}"
    )
    assert final.get("subtype") == "success", final
    searches = [
        args
        for args in (json.loads(line) for line in calls.read_text().splitlines())
        if "search" in args and ("m" in args or "memories" in args)
    ]
    assert searches, "Startup context was loaded but no targeted memory search occurred"
    assert any(marker in " ".join(args) for args in searches), searches
    assert chosen_option in final.get("result", ""), (
        "Retrieved decision was not used in the final answer"
    )
    hook_responses = [
        event
        for event in events
        if event.get("type") == "system" and event.get("subtype") == "hook_response"
    ]
    assert any(
        "Loaded session context" in event.get("stdout", "") for event in hook_responses
    )
