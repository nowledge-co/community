import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATHS = ['nowledge-mem-cursor-plugin/rules/nowledge-mem.mdc', 'nowledge-mem-alma-plugin/alma-skill-nowledge-mem.md', 'nowledge-mem-alma-plugin/README.md', 'nowledge-mem-alma-plugin/CLAUDE.md', 'nowledge-mem-codex-plugin/AGENTS.md', 'nowledge-mem-codex-prompts/search_memory.md', 'nowledge-mem-codex-prompts/AGENTS.md', 'nowledge-mem-npx-skills/README.md', 'nowledge-mem-openclaw-plugin/README.md', 'nowledge-mem-openclaw-plugin/CLAUDE.md', 'nowledge-mem-pi-package/AGENTS.md', 'shared/behavioral-guidance.md', 'nowledge-mem-omp-plugin/AGENTS.md', 'nowledge-mem-omp-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-agent-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-claude-code-plugin/commands/search.md', 'nowledge-mem-claude-code-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-cursor-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-devin-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-pi-package/skills/search-memory/SKILL.md', 'nowledge-mem-openclaw-plugin/skills/memory-guide/SKILL.md', 'nowledge-mem-step-code/skills/search-memory/SKILL.md', 'nowledge-mem-npx-skills/skills/search-memory/SKILL.md', 'nowledge-mem-codex-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-copilot-cli-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-dimagent-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-droid-plugin/commands/nowledge-search-memory.md', 'nowledge-mem-droid-plugin/skills/search-memory/SKILL.md']

class ThreadRetrievalGuidance(unittest.TestCase):
    def test_thread_reads_have_a_budget_and_failure_exit(self):
        for name in PATHS:
            with self.subTest(path=name):
                text = (ROOT / name).read_text()
                self.assertIn("at most once per question", text)
                self.assertIn("Never loop over offsets", text)
                self.assertIn("Do not raise", text)
                self.assertIn("report the evidence gap", text)
                self.assertIn("refine the search", text)
                self.assertNotIn("t show` loads the whole thread", text)
                self.assertNotRegex(text, r"(?i)(?:increase|higher)[^\n]*offset|offset=50 for next page")
                for line in text.splitlines():
                    if re.search(r"thread|conversation|t show", line, re.I) and not line.startswith("description:"):
                        self.assertNotRegex(line, r"(?i)progressiv")

    def test_agent_tool_descriptions_do_not_encourage_page_walks(self):
        for name in ["nowledge-mem-openclaw-plugin/src/tools/thread-fetch.js", "nowledge-mem-alma-plugin/main.js"]:
            with self.subTest(path=name):
                text = (ROOT / name).read_text()
                self.assertIn("at most one small targeted message range per question", text)
                self.assertIn("Never loop over offsets", text)
                self.assertIn("report the evidence gap and refine search", text)
                self.assertNotIn("fetch the first page, then request more", text)
                self.assertNotIn("offset to skip earlier messages for progressive retrieval", text)

    def test_graph_expansion_remains_distinct(self):
        text = (ROOT / "nowledge-mem-codex-plugin/skills/search-memory/SKILL.md").read_text()
        self.assertIn("Progressive graph search", text)
        self.assertIn("maximum depth", text)

if __name__ == "__main__":
    unittest.main()
