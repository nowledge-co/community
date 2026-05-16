"""Static contract tests for the Proma Nowledge Mem plugin.

Run without credentials:
    uv run --with pytest pytest tests/plugin_e2e -q -k proma

Live smoke test (requires Proma + nmem):
    NMEM_PLUGIN_E2E=1 NMEM_PLUGIN_E2E_HOSTS=proma uv run --with pytest pytest tests/plugin_e2e -q -k proma
"""

from __future__ import annotations

import json
import os
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
        assert "hooks" in data
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

    def test_save_script_has_uvx_fallback(self):
        script = PLUGIN_DIR / "hooks" / "read-working-memory.py"
        content = script.read_text(encoding="utf-8")
        assert "uvx" in content.lower(), (
            "read-working-memory.py should include uvx fallback per plugin guide"
        )


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
        assert "0.1.0" in content, "CHANGELOG should document version 0.1.0"
