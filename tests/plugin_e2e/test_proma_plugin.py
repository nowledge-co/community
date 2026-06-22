"""Static contract tests for the Proma Nowledge Mem plugin.

Run without credentials:
    uv run --with pytest pytest tests/plugin_e2e -q -k proma

Live smoke test (requires Proma + nmem):
    NMEM_PLUGIN_E2E=1 NMEM_PLUGIN_E2E_HOSTS=proma uv run --with pytest pytest tests/plugin_e2e -q -k proma
"""

from __future__ import annotations

import importlib.util
import io
import json
import sys
from pathlib import Path

import pytest

PLUGIN_DIR = Path(__file__).resolve().parents[2] / "nowledge-mem-proma-plugin"


# ---------------------------------------------------------------------------
# Static contract tests (no credentials or server needed)
# ---------------------------------------------------------------------------

class TestPluginManifest:
    def test_plugin_json_exists(self):
        manifest = PLUGIN_DIR / ".claude-plugin" / "plugin.json"
        assert manifest.exists(), f"Missing manifest: {manifest}"

    def test_plugin_json_valid(self):
        manifest = PLUGIN_DIR / ".claude-plugin" / "plugin.json"
        data = json.loads(manifest.read_text(encoding="utf-8"))
        assert data["name"] == "nowledge-mem"
        assert "version" in data
        assert "description" in data

    def test_plugin_json_required_fields(self):
        manifest = PLUGIN_DIR / ".claude-plugin" / "plugin.json"
        data = json.loads(manifest.read_text(encoding="utf-8"))
        for field in ("name", "version", "description", "author", "license"):
            assert field in data, f"Missing field: {field}"


class TestHooksConfig:
    def test_hooks_json_exists(self):
        hooks = PLUGIN_DIR / "hooks" / "hooks.json"
        assert hooks.exists(), f"Missing hooks config: {hooks}"

    def test_hooks_json_valid(self):
        hooks = PLUGIN_DIR / "hooks" / "hooks.json"
        data = json.loads(hooks.read_text(encoding="utf-8"))
        assert data["installPath"] == "~/.proma/sdk-config/.claude/settings.json"
        assert data["scriptInstallPath"] == "~/.proma/scripts/"
        assert "hooks" in data
        assert "UserPromptSubmit" in data["hooks"], "Missing UserPromptSubmit hook"
        assert "Stop" in data["hooks"], "Missing Stop hook"
        assert "SessionStart" in data["hooks"], "Missing SessionStart hook"

    def test_stop_hook_has_save_script(self):
        hooks = PLUGIN_DIR / "hooks" / "hooks.json"
        data = json.loads(hooks.read_text(encoding="utf-8"))
        stop_hooks = data["hooks"]["Stop"]
        commands = []
        for group in stop_hooks:
            for h in group.get("hooks", []):
                if h.get("type") == "command":
                    commands.append(h.get("command", ""))
        assert any("save-to-nmem.py" in c for c in commands), (
            f"Stop hook should reference save-to-nmem.py: {commands}"
        )
        assert any("--rewake" in c for c in commands), (
            f"Stop hook should include asyncRewake Working Memory refresh: {commands}"
        )
        assert any(h.get("asyncRewake") is True for group in stop_hooks for h in group.get("hooks", [])), (
            "Stop hook should enable asyncRewake for live Working Memory refresh"
        )

    def test_user_prompt_submit_has_save_script(self):
        hooks = PLUGIN_DIR / "hooks" / "hooks.json"
        data = json.loads(hooks.read_text(encoding="utf-8"))
        commands = [
            h.get("command", "")
            for group in data["hooks"]["UserPromptSubmit"]
            for h in group.get("hooks", [])
            if h.get("type") == "command"
        ]
        assert any("save-to-nmem.py" in c for c in commands), (
            f"UserPromptSubmit should reference save-to-nmem.py: {commands}"
        )

    def test_session_start_hook_has_wm_script(self):
        hooks = PLUGIN_DIR / "hooks" / "hooks.json"
        data = json.loads(hooks.read_text(encoding="utf-8"))
        ss_hooks = data["hooks"].get("SessionStart", [])
        commands = []
        for group in ss_hooks:
            for h in group.get("hooks", []):
                if h.get("type") == "command":
                    commands.append(h.get("command", ""))
        assert any("read-working-memory.py" in c for c in commands), (
            f"SessionStart hook should reference read-working-memory.py: {commands}"
        )


class TestHookScripts:
    def test_save_script_exists(self):
        script = PLUGIN_DIR / "hooks" / "save-to-nmem.py"
        assert script.exists(), f"Missing: {script}"

    def test_wm_script_exists(self):
        script = PLUGIN_DIR / "hooks" / "read-working-memory.py"
        assert script.exists(), f"Missing: {script}"

    def test_save_script_syntax(self):
        import py_compile
        script = PLUGIN_DIR / "hooks" / "save-to-nmem.py"
        try:
            py_compile.compile(str(script), doraise=True)
        except py_compile.PyCompileError as exc:
            pytest.fail(f"Syntax error in save-to-nmem.py: {exc}")

    def test_wm_script_syntax(self):
        import py_compile
        script = PLUGIN_DIR / "hooks" / "read-working-memory.py"
        try:
            py_compile.compile(str(script), doraise=True)
        except py_compile.PyCompileError as exc:
            pytest.fail(f"Syntax error in read-working-memory.py: {exc}")

    def test_wm_script_has_uvx_fallback(self):
        script = PLUGIN_DIR / "hooks" / "read-working-memory.py"
        content = script.read_text(encoding="utf-8")
        assert '"context", "--source-app", "proma"' in content
        assert '"wm", "read"' in content
        assert "uvx" in content.lower(), (
            "read-working-memory.py should include uvx fallback per plugin guide"
        )
        assert "uv tool" not in content.lower(), (
            "read-working-memory.py should not treat uv like uvx; only uvx supports --from directly"
        )

    def test_save_script_allows_local_mode_without_api_key(self):
        script = PLUGIN_DIR / "hooks" / "save-to-nmem.py"
        content = script.read_text(encoding="utf-8")
        assert "skip: no API key" not in content
        assert "if not API_KEY" not in content
        assert "if API_KEY:" in content

    def test_save_script_supports_legacy_and_current_config_keys(self):
        script = PLUGIN_DIR / "hooks" / "save-to-nmem.py"
        content = script.read_text(encoding="utf-8")
        assert '"apiUrl", "api_url"' in content
        assert '"apiKey", "api_key"' in content
        assert "sdk-config" in content
        assert "projects" in content
        assert "agent-sessions" in content

    def test_save_script_appends_existing_threads(self):
        script = PLUGIN_DIR / "hooks" / "save-to-nmem.py"
        content = script.read_text(encoding="utf-8")
        assert 'api_request("GET", f"/threads/{thread_path_id}")' in content
        assert 'api_request("POST", f"/threads/{thread_path_id}/append", append_body)' in content
        assert '"deduplicate": True' in content
        assert '"idempotency_key": f"proma:{session_id}"' in content
        assert 'metadata["external_id"] = f"proma:{uuid}"' in content

    def test_save_script_workspace_filter_defaults_to_allow_all(self, monkeypatch):
        monkeypatch.delenv("PROMA_ALLOWED_WORKSPACES", raising=False)
        module = _load_hook_module(
            "proma_save_hook_workspace_filter_unset",
            PLUGIN_DIR / "hooks" / "save-to-nmem.py",
        )

        assert module.ALLOWED_WORKSPACE_DIRS is None
        assert module._parse_allowed_workspaces("") is None
        assert module._parse_allowed_workspaces("   ") is None
        assert module._parse_allowed_workspaces("*") is None
        assert module._parse_allowed_workspaces("all") is None

    def test_save_script_workspace_filter_parses_explicit_allowlist(self, monkeypatch):
        monkeypatch.setenv("PROMA_ALLOWED_WORKSPACES", "default, research ,personal")
        module = _load_hook_module(
            "proma_save_hook_workspace_filter_allowlist",
            PLUGIN_DIR / "hooks" / "save-to-nmem.py",
        )

        assert module.ALLOWED_WORKSPACE_DIRS == {"default", "research", "personal"}

    def test_save_script_resolves_workspace_dir_from_cwd(self, tmp_path, monkeypatch):
        proma_home = tmp_path / ".proma"
        workspace = proma_home / "agent-workspaces" / "research" / "project"
        workspace.mkdir(parents=True)
        outside = tmp_path / "outside"
        outside.mkdir()
        monkeypatch.setenv("PROMA_HOME", str(proma_home))

        module = _load_hook_module(
            "proma_save_hook_workspace_filter_resolution",
            PLUGIN_DIR / "hooks" / "save-to-nmem.py",
        )

        assert module.workspace_dir_from_cwd(str(workspace)) == "research"
        assert module.workspace_dir_from_cwd(str(outside)) is None
        assert module.workspace_dir_from_cwd(None) is None

    def test_save_script_without_allowlist_accepts_missing_cwd(self, tmp_path, monkeypatch):
        proma_home = tmp_path / ".proma"
        monkeypatch.setenv("PROMA_HOME", str(proma_home))
        monkeypatch.delenv("PROMA_ALLOWED_WORKSPACES", raising=False)
        module = _load_hook_module(
            "proma_save_hook_workspace_filter_missing_cwd_allowed",
            PLUGIN_DIR / "hooks" / "save-to-nmem.py",
        )

        session_dir = proma_home / "sdk-config" / "projects" / "workspace-hash"
        session_dir.mkdir(parents=True)
        (session_dir / "session-123.jsonl").write_text(
            json.dumps({
                "type": "user",
                "uuid": "u1",
                "message": {"role": "user", "content": "sync without cwd"},
            }),
            encoding="utf-8",
        )

        uploads = []
        monkeypatch.setattr(
            module,
            "upload_thread",
            lambda session_id, messages, cwd: (
                uploads.append((session_id, messages, cwd)) or True
            ),
        )
        monkeypatch.setattr(sys, "argv", ["save-to-nmem.py"])
        monkeypatch.setattr(
            sys,
            "stdin",
            io.StringIO(json.dumps({"session_id": "session-123"})),
        )

        assert module.main() == 0
        assert uploads == [
            (
                "session-123",
                [
                    {
                        "role": "user",
                        "content": "sync without cwd",
                        "metadata": {"external_id": "proma:u1"},
                    }
                ],
                None,
            )
        ]

    def test_save_script_with_allowlist_skips_missing_cwd(self, tmp_path, monkeypatch):
        proma_home = tmp_path / ".proma"
        monkeypatch.setenv("PROMA_HOME", str(proma_home))
        monkeypatch.setenv("PROMA_ALLOWED_WORKSPACES", "default")
        module = _load_hook_module(
            "proma_save_hook_workspace_filter_missing_cwd_skipped",
            PLUGIN_DIR / "hooks" / "save-to-nmem.py",
        )

        uploads = []
        monkeypatch.setattr(
            module,
            "upload_thread",
            lambda *args: uploads.append(args) or True,
        )
        monkeypatch.setattr(sys, "argv", ["save-to-nmem.py"])
        monkeypatch.setattr(
            sys,
            "stdin",
            io.StringIO(json.dumps({"session_id": "session-123"})),
        )

        assert module.main() == 0
        assert uploads == []

    def test_save_script_parses_current_proma_sdk_jsonl(self, tmp_path, monkeypatch):
        proma_home = tmp_path / ".proma"
        monkeypatch.setenv("PROMA_HOME", str(proma_home))
        module = _load_hook_module("proma_save_hook", PLUGIN_DIR / "hooks" / "save-to-nmem.py")

        session_dir = proma_home / "sdk-config" / "projects" / "workspace-hash"
        session_dir.mkdir(parents=True)
        session_file = session_dir / "session-123.jsonl"
        session_file.write_text(
            "\n".join(
                [
                    json.dumps({
                        "type": "user",
                        "uuid": "u1",
                        "timestamp": "2026-06-13T01:00:00Z",
                        "message": {"role": "user", "content": "hello proma"},
                    }),
                    json.dumps({
                        "type": "assistant",
                        "uuid": "a1",
                        "timestamp": "2026-06-13T01:00:01Z",
                        "message": {
                            "role": "assistant",
                            "content": [
                                {"type": "thinking", "text": "hidden"},
                                {"type": "text", "text": "saved"},
                                {"type": "tool_use", "name": "Read"},
                            ],
                        },
                    }),
                    json.dumps({
                        "type": "assistant",
                        "uuid": "a1",
                        "message": {"role": "assistant", "content": [{"type": "text", "text": "duplicate"}]},
                    }),
                ]
            ),
            encoding="utf-8",
        )

        assert module.find_session_file("session-123") == session_file
        messages = module.parse_session_messages(session_file)
        assert messages == [
            {
                "role": "user",
                "content": "hello proma",
                "metadata": {"external_id": "proma:u1", "timestamp": "2026-06-13T01:00:00Z"},
            },
            {
                "role": "assistant",
                "content": "saved\n[tool: Read]",
                "metadata": {"external_id": "proma:a1", "timestamp": "2026-06-13T01:00:01Z"},
            },
        ]

    def test_save_script_does_not_fallback_latest_when_session_id_missing(self, tmp_path, monkeypatch):
        proma_home = tmp_path / ".proma"
        monkeypatch.setenv("PROMA_HOME", str(proma_home))
        module = _load_hook_module(
            "proma_save_hook_missing_session",
            PLUGIN_DIR / "hooks" / "save-to-nmem.py",
        )

        session_dir = proma_home / "sdk-config" / "projects" / "workspace-hash"
        session_dir.mkdir(parents=True)
        (session_dir / "other-session.jsonl").write_text(
            json.dumps({
                "type": "user",
                "uuid": "u1",
                "message": {"role": "user", "content": "wrong session"},
            }),
            encoding="utf-8",
        )

        assert module.find_session_file("missing-session") is None
        assert module.find_session_file(None) == session_dir / "other-session.jsonl"

    def test_working_memory_script_replaces_managed_claude_block(self, tmp_path, monkeypatch):
        proma_home = tmp_path / ".proma"
        workspace = proma_home / "agent-workspaces" / "default"
        workspace.mkdir(parents=True)
        template = workspace / "CLAUDE.md.template"
        template.write_text("# Project Rules\n\nKeep this line.\n", encoding="utf-8")
        monkeypatch.setenv("PROMA_HOME", str(proma_home))

        module = _load_hook_module("proma_wm_hook", PLUGIN_DIR / "hooks" / "read-working-memory.py")
        assert module.update_claude_md("first context") is True
        assert "first context" in (workspace / "CLAUDE.md").read_text(encoding="utf-8")

        assert module.update_claude_md("second context") is True
        rendered = (workspace / "CLAUDE.md").read_text(encoding="utf-8")
        assert "Keep this line." in rendered
        assert "second context" in rendered
        assert "first context" not in rendered
        assert rendered.count("nowledge-mem:start") == 1

    def test_working_memory_script_preserves_user_claude_md_when_template_exists(self, tmp_path, monkeypatch):
        proma_home = tmp_path / ".proma"
        workspace = proma_home / "agent-workspaces" / "default"
        workspace.mkdir(parents=True)
        (workspace / "CLAUDE.md.template").write_text("# Template\n", encoding="utf-8")
        claude_md = workspace / "CLAUDE.md"
        claude_md.write_text(
            "# User Rules\n\n"
            "<!-- nowledge-mem:start -->\nold\n<!-- nowledge-mem:end -->\n"
            "    indented user content\n",
            encoding="utf-8",
        )
        monkeypatch.setenv("PROMA_HOME", str(proma_home))

        module = _load_hook_module(
            "proma_wm_hook_preserve_user_content",
            PLUGIN_DIR / "hooks" / "read-working-memory.py",
        )
        assert module.update_claude_md("new context") is True
        rendered = claude_md.read_text(encoding="utf-8")
        assert "# User Rules" in rendered
        assert "# Template" not in rendered
        assert "new context" in rendered
        assert "old" not in rendered
        assert "    indented user content" in rendered


class TestSkills:
    REQUIRED_SKILLS = [
        "read-working-memory",
        "search-memory",
        "distill-memory",
        "save-thread",
        "status",
    ]

    @pytest.mark.parametrize("skill_name", REQUIRED_SKILLS)
    def test_skill_directory_exists(self, skill_name):
        skill_dir = PLUGIN_DIR / "skills" / skill_name
        assert skill_dir.is_dir(), f"Missing skill directory: {skill_dir}"

    @pytest.mark.parametrize("skill_name", REQUIRED_SKILLS)
    def test_skill_md_exists(self, skill_name):
        skill_md = PLUGIN_DIR / "skills" / skill_name / "SKILL.md"
        assert skill_md.exists(), f"Missing SKILL.md: {skill_md}"

    @pytest.mark.parametrize("skill_name", REQUIRED_SKILLS)
    def test_skill_md_has_content(self, skill_name):
        skill_md = PLUGIN_DIR / "skills" / skill_name / "SKILL.md"
        content = skill_md.read_text(encoding="utf-8").strip()
        assert len(content) > 100, (
            f"SKILL.md for {skill_name} is too short ({len(content)} chars)"
        )

    @pytest.mark.parametrize("skill_name", REQUIRED_SKILLS)
    def test_skill_md_has_frontmatter(self, skill_name):
        skill_md = PLUGIN_DIR / "skills" / skill_name / "SKILL.md"
        content = skill_md.read_text(encoding="utf-8")
        assert content.startswith("---\n"), f"Missing YAML frontmatter: {skill_md}"
        assert f"name: {skill_name}" in content
        assert "description:" in content.split("---", 2)[1]

    def test_no_legacy_nmem_skill(self):
        legacy = PLUGIN_DIR / "skills" / "nmem"
        assert not legacy.exists(), (
            "Legacy unified 'nmem' skill should be removed in favor of standard skills"
        )


class TestIntegrationsJson:
    def test_proma_entry_exists(self):
        repo_root = PLUGIN_DIR.parent
        ij = json.loads((repo_root / "integrations.json").read_text(encoding="utf-8"))
        ids = [i["id"] for i in ij["integrations"]]
        assert "proma" in ids, "Proma entry missing from integrations.json"

    def test_proma_entry_has_required_fields(self):
        repo_root = PLUGIN_DIR.parent
        ij = json.loads((repo_root / "integrations.json").read_text(encoding="utf-8"))
        entry = next(i for i in ij["integrations"] if i["id"] == "proma")
        for field in ("id", "name", "category", "type", "version", "directory",
                       "transport", "capabilities", "threadSave", "autonomy", "install"):
            assert field in entry, f"Missing field in integrations.json entry: {field}"

    def test_proma_skills_match_plugin(self):
        repo_root = PLUGIN_DIR.parent
        ij = json.loads((repo_root / "integrations.json").read_text(encoding="utf-8"))
        entry = next(i for i in ij["integrations"] if i["id"] == "proma")
        assert set(entry.get("skills", [])) == set(self.REQUIRED_SKILLS), (
            f"integrations.json skills {entry.get('skills')} don't match {self.REQUIRED_SKILLS}"
        )

    def test_proma_entry_uses_plugin_capture_and_guided_mcp_autonomy(self):
        repo_root = PLUGIN_DIR.parent
        ij = json.loads((repo_root / "integrations.json").read_text(encoding="utf-8"))
        entry = next(i for i in ij["integrations"] if i["id"] == "proma")
        assert entry["threadSave"]["method"] == "plugin-capture"
        assert entry["autonomy"]["recall"] == "guided"
        assert entry["autonomy"]["distill"] == "guided"
        assert entry["install"]["docsUrl"] == "/docs/integrations/proma"
        checklist = "\n".join(entry["autonomy"]["bestResultRequires"])
        assert "skills/nmem" not in checklist
        assert "standard Nowledge Mem skill folders" in checklist
        assert "~/.proma/sdk-config/.claude/settings.json" in checklist
        assert "~/.proma/scripts/" in checklist

    REQUIRED_SKILLS = TestSkills.REQUIRED_SKILLS


class TestReadme:
    def test_readme_exists(self):
        readme = PLUGIN_DIR / "README.md"
        assert readme.exists(), "Missing README.md"

    def test_readme_mentions_proma(self):
        readme = PLUGIN_DIR / "README.md"
        content = readme.read_text(encoding="utf-8").lower()
        assert "proma" in content, "README should mention Proma"

    def test_readme_has_install_steps(self):
        readme = PLUGIN_DIR / "README.md"
        content = readme.read_text(encoding="utf-8")
        assert "mcp.json" in content, "README should document mcp.json setup"
        assert "settings.json" in content, "README should document settings.json hooks"
        assert "CLAUDE.md" in content, "README should document CLAUDE.md guidance"


class TestChangelog:
    def test_changelog_exists(self):
        cl = PLUGIN_DIR / "CHANGELOG.md"
        assert cl.exists(), "Missing CHANGELOG.md"

    def test_changelog_has_version(self):
        cl = PLUGIN_DIR / "CHANGELOG.md"
        content = cl.read_text(encoding="utf-8")
        assert "0.1.3" in content, "CHANGELOG should document version 0.1.3"
        assert "0.1.2" in content, "CHANGELOG should document version 0.1.2"
        assert "0.1.1" in content, "CHANGELOG should document version 0.1.1"
        assert "0.1.0" in content, "CHANGELOG should document version 0.1.0"


def _load_hook_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
