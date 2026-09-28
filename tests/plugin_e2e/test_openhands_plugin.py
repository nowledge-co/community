"""Static contract tests for the OpenHands Nowledge Mem plugin."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

COMMUNITY_ROOT = Path(__file__).resolve().parents[2]
PLUGIN_DIR = COMMUNITY_ROOT / "nowledge-mem-openhands-plugin"


class TestOpenHandsPluginManifest:
    def test_plugin_json_exists(self) -> None:
        manifest = PLUGIN_DIR / ".plugin" / "plugin.json"
        assert manifest.exists(), f"Missing manifest: {manifest}"

    def test_root_plugin_json_absent_for_openhands_format_compatibility(self) -> None:
        # A root 'plugin.json' triggers OpenHands SDK's AgentPluginsFormat detector instead of
        # the Claude Code format, causing a 422 ("Ensure it has a valid kebab-case name") schema error.
        manifest_root = PLUGIN_DIR / "plugin.json"
        assert not manifest_root.exists(), "Root plugin.json must not exist; OpenHands uses .plugin/plugin.json"

    def test_plugin_json_valid_and_consistent(self) -> None:
        manifest_dot = json.loads((PLUGIN_DIR / ".plugin" / "plugin.json").read_text(encoding="utf-8"))

        assert manifest_dot["name"] == "nowledge-mem"
        for field in ("name", "version", "description", "author", "license", "keywords"):
            assert field in manifest_dot, f"Missing field: {field}"
        assert "openhands" in manifest_dot["keywords"]
        assert "openhands-canvas" in manifest_dot["keywords"]
        assert "multi-agent" in manifest_dot["keywords"]


class TestOpenHandsMcpConfig:
    def test_mcp_json_exists(self) -> None:
        assert (PLUGIN_DIR / ".mcp.json").exists()
        assert (PLUGIN_DIR / "mcp.json").exists()

    def test_mcp_json_valid_and_no_trailing_slash(self) -> None:
        for p in (PLUGIN_DIR / ".mcp.json", PLUGIN_DIR / "mcp.json"):
            data = json.loads(p.read_text(encoding="utf-8"))
            assert "mcpServers" in data
            assert "nowledge-mem" in data["mcpServers"]
            server = data["mcpServers"]["nowledge-mem"]
            assert server["type"] == "http"
            assert server["url"] == "${NMEM_API_URL:-http://127.0.0.1:14242}/mcp"
            assert not server["url"].endswith("/")


class TestOpenHandsHooksConfig:
    def test_hooks_json_exists(self) -> None:
        hooks_path = PLUGIN_DIR / "hooks" / "hooks.json"
        assert hooks_path.exists(), f"Missing hooks config: {hooks_path}"

    def test_hooks_json_valid(self) -> None:
        hooks_path = PLUGIN_DIR / "hooks" / "hooks.json"
        data = json.loads(hooks_path.read_text(encoding="utf-8"))
        assert "hooks" in data
        hooks = data["hooks"]
        assert "UserPromptSubmit" in hooks
        assert "PostToolUse" in hooks
        assert "Stop" in hooks

        for event in ("UserPromptSubmit", "PostToolUse", "Stop"):
            entries = hooks[event]
            assert isinstance(entries, list) and len(entries) > 0
            hook_def = entries[0]["hooks"][0]
            assert hook_def["type"] == "command"
            assert "command" in hook_def
            assert hook_def.get("timeout", 0) > 0


class TestOpenHandsSkills:
    REQUIRED_SKILLS = [
        "read-working-memory",
        "search-memory",
        "distill-memory",
        "save-handoff",
        "save-thread",
        "status",
        "check-integration",
    ]

    def test_all_skills_exist(self) -> None:
        for skill_name in self.REQUIRED_SKILLS:
            skill_md = PLUGIN_DIR / "skills" / skill_name / "SKILL.md"
            assert skill_md.exists(), f"Missing skill: {skill_name}"

    def test_skill_frontmatter(self) -> None:
        for skill_name in self.REQUIRED_SKILLS:
            skill_md = PLUGIN_DIR / "skills" / skill_name / "SKILL.md"
            content = skill_md.read_text(encoding="utf-8")
            assert content.startswith("---"), f"{skill_name} missing YAML frontmatter"
            assert f"name: {skill_name}" in content
            assert "description:" in content

    def test_distill_memory_autonomous_rule(self) -> None:
        distill_md = (PLUGIN_DIR / "skills" / "distill-memory" / "SKILL.md").read_text(encoding="utf-8")
        assert (
            "Save proactively when the conversation produces a durable fact, preference, decision, plan, procedure, learning, event, or important context. Do not wait to be asked."
            in distill_md
        )

    def test_read_working_memory_multi_agent_routing(self) -> None:
        wm_md = (PLUGIN_DIR / "skills" / "read-working-memory" / "SKILL.md").read_text(encoding="utf-8")
        assert "NMEM_AGENT_ID" in wm_md
        assert "NMEM_SPACE" in wm_md
        assert "OpenHands" in wm_md


class TestOpenHandsHookScriptsExecution:
    def test_nmem_shared_importable(self) -> None:
        spec = importlib.util.spec_from_file_location(
            "nmem_shared", PLUGIN_DIR / "hooks" / "nmem_shared.py"
        )
        assert spec is not None
        assert spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        assert hasattr(module, "read_startup_context")
        assert hasattr(module, "resolve_space")
        assert hasattr(module, "resolve_agent_id")
        assert hasattr(module, "get_host_agent_fingerprint")

    def test_agent_id_resolution(self, monkeypatch: pytest.MonkeyPatch) -> None:
        spec = importlib.util.spec_from_file_location(
            "nmem_shared_agent_test", PLUGIN_DIR / "hooks" / "nmem_shared.py"
        )
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        monkeypatch.setenv("NMEM_AGENT_ID", "canvas-planner")
        assert module.resolve_agent_id() == "canvas-planner"

        monkeypatch.delenv("NMEM_AGENT_ID")
        monkeypatch.setenv("OPENHANDS_AGENT_NAME", "coder-agent")
        assert module.resolve_agent_id() == "coder-agent"

    def test_space_resolution(self, monkeypatch: pytest.MonkeyPatch) -> None:
        spec = importlib.util.spec_from_file_location(
            "nmem_shared_space_test", PLUGIN_DIR / "hooks" / "nmem_shared.py"
        )
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        monkeypatch.setenv("NMEM_SPACE", "canvas-space-1")
        assert module.resolve_space() == "canvas-space-1"

    def test_hook_context_script_execution(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(PLUGIN_DIR / "hooks" / "nmem-context.py")],
            input="",
            capture_output=True,
            text=True,
            timeout=5.0,
        )
        assert proc.returncode == 0
        data = json.loads(proc.stdout)
        assert isinstance(data, dict)

    def test_hook_post_tool_script_execution(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(PLUGIN_DIR / "hooks" / "nmem-post-tool.py")],
            input="",
            capture_output=True,
            text=True,
            timeout=5.0,
        )
        assert proc.returncode == 0
        data = json.loads(proc.stdout)
        assert data == {}

    def test_hook_stop_script_execution(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(PLUGIN_DIR / "hooks" / "nmem-stop.py")],
            input=json.dumps({"conversationId": "test-session-123"}),
            capture_output=True,
            text=True,
            timeout=5.0,
        )
        assert proc.returncode == 0
        data = json.loads(proc.stdout)
        assert data.get("decision") == "approve"


class TestOpenHandsRegistryIntegration:
    def test_integrations_json_entry(self) -> None:
        registry = json.loads((COMMUNITY_ROOT / "integrations.json").read_text(encoding="utf-8"))
        assert "openhands" in registry["connect"]["appliesTo"]

        entry = next((item for item in registry["integrations"] if item.get("id") == "openhands"), None)
        assert entry is not None, "Missing openhands entry in integrations.json"
        assert entry["name"] == "OpenHands"
        assert entry["category"] == "orchestrator"
        assert entry["type"] == "plugin"
        assert entry["directory"] == "nowledge-mem-openhands-plugin"
        assert entry["transport"] == "plugin+mcp+cli"
        assert entry["capabilities"]["workingMemory"] is True
        assert entry["capabilities"]["autoRecall"] is True
        assert entry["capabilities"]["autoCapture"] is True
        assert entry["skills"] == TestOpenHandsSkills.REQUIRED_SKILLS

    def test_community_readme_references_openhands(self) -> None:
        readme = (COMMUNITY_ROOT / "README.md").read_text(encoding="utf-8")
        assert "OpenHands Plugin" in readme
        assert "nowledge-mem-openhands-plugin" in readme


class TestOpenHandsRemoteAndResilience:
    def test_sync_mcp_config_file_remote(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        target_mcp = tmp_path / "mcp.json"
        monkeypatch.setenv("NMEM_API_URL", "https://mem.remote-node.net")
        monkeypatch.setenv("NMEM_API_KEY", "test-token-12345")

        updated = nmem_shared.sync_mcp_config_file(mcp_config_path=target_mcp)
        assert updated is True
        assert target_mcp.exists()

        data = json.loads(target_mcp.read_text(encoding="utf-8"))
        server = data["mcpServers"]["nowledge-mem"]
        assert server["url"] == "https://mem.remote-node.net/mcp"
        assert not server["url"].endswith("/")
        assert server["headers"]["Authorization"] == "Bearer test-token-12345"
        assert server["headers"]["X-MEM-API-Key"] == "test-token-12345"
        assert server["headers"]["X-NMEM-API-Key"] == "test-token-12345"
        assert server["headers"]["APP"] == "OpenHands"

    def test_unsynced_session_queue(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        queue_file = tmp_path / "unsynced.json"
        monkeypatch.setattr(nmem_shared, "get_unsynced_queue_path", lambda: queue_file)

        saved = nmem_shared.save_unsynced_session("conv-test-999", {"session": "data"})
        assert saved is True
        assert queue_file.exists()

        data = json.loads(queue_file.read_text(encoding="utf-8"))
        assert "conv-test-999" in data


class TestOpenHandsTranscriptSync:
    def test_find_and_parse_openhands_events(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        conv_id = "test-session-abc"
        conv_dir = tmp_path / "conversations" / conv_id
        events_dir = conv_dir / "events"
        events_dir.mkdir(parents=True)

        meta_path = conv_dir / "meta.json"
        meta_path.write_text(json.dumps({"title": "Test Plan Session"}), encoding="utf-8")

        # Mock events
        (events_dir / "event-001.json").write_text(json.dumps({
            "kind": "MessageEvent",
            "source": "user",
            "llm_message": {"role": "user", "content": [{"type": "text", "text": "Plan architecture"}]}
        }), encoding="utf-8")

        (events_dir / "event-002.json").write_text(json.dumps({
            "kind": "ActionEvent",
            "source": "agent",
            "action": {"kind": "FinishAction", "message": "Architecture planned"}
        }), encoding="utf-8")

        # Duplicate observation that should be deduplicated
        (events_dir / "event-003.json").write_text(json.dumps({
            "kind": "ObservationEvent",
            "source": "agent",
            "observation": {"kind": "FinishObservation", "content": "Architecture planned"}
        }), encoding="utf-8")

        monkeypatch.setenv("OPENHANDS_CONVERSATIONS_PATH", str(tmp_path / "conversations"))
        found = nmem_shared.find_conversation_dir(conv_id)
        assert found is not None
        assert found == conv_dir

        title, messages = nmem_shared.parse_openhands_events(found)
        assert title == "Test Plan Session"
        assert len(messages) == 2
        assert messages[0] == {"role": "user", "content": "Plan architecture"}
        assert messages[1] == {"role": "assistant", "content": "Architecture planned"}

    def test_sync_openhands_thread_offline_buffering(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        queue_file = tmp_path / "unsynced.json"
        monkeypatch.setattr(nmem_shared, "get_unsynced_queue_path", lambda: queue_file)
        monkeypatch.setattr(nmem_shared, "is_backend_unreachable", lambda: True)
        monkeypatch.setattr(nmem_shared, "run_nmem_command", lambda *args, **kwargs: None)

        conv_id = "buffered-session-123"
        result = nmem_shared.sync_openhands_thread(
            conv_id,
            hook_input={"message": "Buffered offline prompt"}
        )
        assert result is None
        assert queue_file.exists()

        data = json.loads(queue_file.read_text(encoding="utf-8"))
        assert conv_id in data
        assert data[conv_id]["payload"]["messages"][0]["content"] == "Buffered offline prompt"

    def test_openhands_sdk_load_plugin(self, tmp_path: Path) -> None:
        agent_python = Path("/home/abn/.local/share/uv/tools/openhands-agent-server/bin/python")
        if not agent_python.exists():
            pytest.skip("OpenHands SDK python environment not found")

        code = (
            "from pathlib import Path\n"
            "from openhands.sdk.plugin import Plugin, install_plugin\n"
            f"plugin = Plugin.load({str(PLUGIN_DIR)!r})\n"
            "assert plugin.name == 'nowledge-mem'\n"
            "assert len(plugin.skills) >= 6\n"
            "assert plugin.hooks is not None\n"
            "assert plugin.mcp_config is not None\n"
            f"installed = install_plugin({str(PLUGIN_DIR)!r}, installed_dir=Path({str(tmp_path)!r}), force=True)\n"
            "assert installed.name == 'nowledge-mem'\n"
        )
        res = subprocess.run([str(agent_python), "-c", code], capture_output=True, text=True)
        assert res.returncode == 0, f"OpenHands SDK Plugin load failed: {res.stderr}"


class TestReviewerFindingsDetection:
    def test_get_effective_config_cross_host_isolation(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        global_cfg = tmp_path / "global_config.json"
        global_cfg.write_text(json.dumps({"apiUrl": "https://trusted.global.org", "apiKey": "secret-global-token"}), encoding="utf-8")
        monkeypatch.setattr(Path, "expanduser", lambda p: global_cfg if "~/.nowledge-mem/config.json" in str(p) else Path(p))

        workspace_dir = tmp_path / "workspace"
        workspace_dir.mkdir()
        (workspace_dir / ".config.json").write_text(json.dumps({"apiUrl": "https://untrusted.workspace.org"}), encoding="utf-8")

        monkeypatch.delenv("NMEM_API_URL", raising=False)
        monkeypatch.delenv("NMEM_API_KEY", raising=False)

        url, key = nmem_shared.get_effective_config(cwd=workspace_dir)
        assert url == "https://untrusted.workspace.org"
        assert key is None, f"Global key was leaked to non-global workspace URL: {key}"

    def test_run_nmem_command_supports_cwd(self, tmp_path: Path) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        # Should accept cwd without raising TypeError
        res = nmem_shared.run_nmem_command(["--version"], cwd=tmp_path)
        # res may be None or CompletedProcess, but no TypeError
        assert res is None or hasattr(res, "returncode")

    def test_sync_mcp_config_preserves_existing_servers(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        target_mcp = tmp_path / "mcp.json"
        existing_data = {
            "mcpServers": {
                "custom-tool": {
                    "command": "custom-cmd",
                    "args": ["--start"]
                }
            }
        }
        target_mcp.write_text(json.dumps(existing_data), encoding="utf-8")

        nmem_shared.sync_mcp_config_file(mcp_config_path=target_mcp)
        data = json.loads(target_mcp.read_text(encoding="utf-8"))
        assert "custom-tool" in data["mcpServers"], "Existing MCP server was deleted!"
        assert "nowledge-mem" in data["mcpServers"]

    def test_flush_unsynced_sessions_keeps_failed_status_in_queue(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        queue_file = tmp_path / "unsynced.json"
        monkeypatch.setattr(nmem_shared, "get_unsynced_queue_path", lambda: queue_file)
        monkeypatch.setattr(nmem_shared, "is_backend_unreachable", lambda: False)

        queue_data = {"failed-session-1": {"payload": {"thread_id": "failed-1"}}}
        queue_file.write_text(json.dumps(queue_data), encoding="utf-8")

        # Backend responds with 200 OK but success: false
        monkeypatch.setattr(nmem_shared, "http_request", lambda *args, **kwargs: {"success": False, "failed_count": 1})

        flushed = nmem_shared.flush_unsynced_sessions()
        assert flushed == 0
        assert queue_file.exists(), "Failed session was discarded from queue!"
        saved = json.loads(queue_file.read_text(encoding="utf-8"))
        assert "failed-session-1" in saved

    def test_file_lock_raises_timeout_error(self, tmp_path: Path) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        lock_path = (tmp_path / "test.json").with_suffix(".json.lock")
        # Write our own PID so it looks like a live process holds it
        lock_path.write_text(str(os.getpid()), encoding="utf-8")

        with pytest.raises(TimeoutError):
            with nmem_shared.FileLock(tmp_path / "test.json", timeout=0.2):
                pass

    def test_sync_openhands_thread_sends_metadata(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        sys.path.insert(0, str(PLUGIN_DIR / "hooks"))
        import nmem_shared

        sent_payloads = []
        monkeypatch.setattr(nmem_shared, "is_backend_unreachable", lambda: False)
        monkeypatch.setattr(nmem_shared, "http_request", lambda ep, method, body, **kw: sent_payloads.append(body) or {"success": True})

        nmem_shared.sync_openhands_thread(
            "sess-123",
            space="project-space",
            agent_id="test-agent",
            hook_input={"message": "Hello test"},
        )
        assert len(sent_payloads) == 1
        payload = sent_payloads[0]
        assert "metadata" in payload, "payload missing metadata dictionary"
        assert payload["metadata"].get("space_id") == "project-space"
        assert payload["metadata"].get("agent_id") == "test-agent"

    def test_hook_json_resolves_project_dir_plugin(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        hooks_path = PLUGIN_DIR / "hooks" / "hooks.json"
        hooks_data = json.loads(hooks_path.read_text(encoding="utf-8"))
        raw_cmd = hooks_data["hooks"]["UserPromptSubmit"][0]["hooks"][0]["command"]

        # Create dummy project directory with .openhands/plugins/nowledge-mem/hooks
        proj_dir = tmp_path / "my_project"
        plugin_target = proj_dir / ".openhands" / "plugins" / "nowledge-mem" / "hooks"
        plugin_target.mkdir(parents=True)
        # Create a mock nmem-context.py that outputs a specific marker
        (plugin_target / "nmem-context.py").write_text(
            "import json; print(json.dumps({'hookSpecificOutput': {'hookEventName': 'UserPromptSubmit', 'additionalContext': 'project-plugin-resolved'}}))\n",
            encoding="utf-8"
        )

        env = os.environ.copy()
        env["OPENHANDS_PROJECT_DIR"] = str(proj_dir)
        env.pop("OPENHANDS_PLUGIN_ROOT", None)
        env.pop("OH_PERSISTENCE_DIR", None)

        proc = subprocess.run(
            raw_cmd,
            shell=True,
            env=env,
            cwd=str(proj_dir),
            capture_output=True,
            text=True,
            timeout=5.0,
        )
        assert proc.returncode == 0
        output = json.loads(proc.stdout)
        assert output.get("hookSpecificOutput", {}).get("additionalContext") == "project-plugin-resolved"

    def test_readme_installation_path_and_mode_clarification(self) -> None:
        readme = (PLUGIN_DIR / "README.md").read_text(encoding="utf-8")
        assert ".openhands/plugins/nowledge-mem" in readme
        assert "All standard Nowledge Mem child connectors" not in readme
