import asyncio
import importlib.util
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATHS = ['nowledge-mem-cursor-plugin/rules/nowledge-mem.mdc', 'nowledge-mem-alma-plugin/alma-skill-nowledge-mem.md', 'nowledge-mem-alma-plugin/README.md', 'nowledge-mem-alma-plugin/CLAUDE.md', 'nowledge-mem-codex-plugin/AGENTS.md', 'nowledge-mem-codex-prompts/search_memory.md', 'nowledge-mem-codex-prompts/AGENTS.md', 'nowledge-mem-npx-skills/README.md', 'nowledge-mem-openclaw-plugin/README.md', 'nowledge-mem-openclaw-plugin/CLAUDE.md', 'nowledge-mem-pi-package/AGENTS.md', 'shared/behavioral-guidance.md', 'nowledge-mem-omp-plugin/AGENTS.md', 'nowledge-mem-omp-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-agent-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-claude-code-plugin/commands/search.md', 'nowledge-mem-claude-code-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-cursor-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-devin-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-pi-package/skills/search-memory/SKILL.md', 'nowledge-mem-openclaw-plugin/skills/memory-guide/SKILL.md', 'nowledge-mem-step-code/skills/search-memory/SKILL.md', 'nowledge-mem-npx-skills/skills/search-memory/SKILL.md', 'nowledge-mem-codex-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-copilot-cli-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-dimagent-plugin/skills/search-memory/SKILL.md', 'nowledge-mem-droid-plugin/commands/nowledge-search-memory.md', 'nowledge-mem-droid-plugin/skills/search-memory/SKILL.md']

PATHS.append("nowledge-mem-alma-plugin/skills/nowledge-mem/SKILL.md")
PATHS.append("nowledge-mem-bub-plugin/src/skills/nowledge-mem/SKILL.md")
PATHS.append("nowledge-mem-bub-plugin/README.md")

class ThreadRetrievalGuidance(unittest.TestCase):
    def test_thread_reads_have_a_budget_and_failure_exit(self):
        for name in PATHS:
            with self.subTest(path=name):
                text = (ROOT / name).read_text(encoding="utf-8")
                self.assertIn("at most once per question", text)
                self.assertIn("Never loop over offsets", text)
                self.assertIn("Do not raise", text)
                self.assertIn("report the evidence gap", text)
                self.assertIn("refine the search", text)
                self.assertNotIn("t show` loads the whole thread", text)
                self.assertNotIn("nowledge_mem_thread_fetch(offset=50, limit=50)", text)
                self.assertNotRegex(text, r"(?i)(?:increase|higher)[^\n]*offset|offset=50 for next page")
                self.assertNotRegex(text, r"(?i)fetch more pages|fetch more only if|read it in pages|fetch more via")
                self.assertNotRegex(text, r"(?i)for full conversation context|fetch full messages[^\n]*pagination|limit: 50")
                for line in text.splitlines():
                    if re.search(r"thread|conversation|t show", line, re.I) and not line.startswith("description:"):
                        self.assertNotRegex(line, r"(?i)progressiv")

    def test_agent_tool_descriptions_do_not_encourage_page_walks(self):
        for name in ["nowledge-mem-openclaw-plugin/src/tools/thread-fetch.js", "nowledge-mem-alma-plugin/main.js"]:
            with self.subTest(path=name):
                text = (ROOT / name).read_text(encoding="utf-8")
                self.assertIn("at most one small targeted message range per question", text)
                self.assertIn("Never loop over offsets", text)
                self.assertIn("report the evidence gap and refine search", text)
                self.assertNotIn("fetch the first page, then request more", text)
                self.assertNotIn("offset to skip earlier messages for progressive retrieval", text)

    def test_bub_thread_output_does_not_invite_next_page(self):
        text = (ROOT / "nowledge-mem-bub-plugin/src/nowledge_mem_bub/tools.py").read_text(encoding="utf-8")
        self.assertNotIn("more messages available — use offset=", text)
        self.assertIn("Read one small targeted message range per question", text)
        self.assertIn("wait for an explicit request for another range", text)

    def test_other_thread_read_defaults_are_small(self):
        alma = (ROOT / "nowledge-mem-alma-plugin/main.js").read_text(encoding="utf-8")
        self.assertIn("async showThread(id, limit = 8, offset = 0)", alma)
        self.assertIn("input?.limit ?? 8", alma)
        self.assertNotIn("maximum: 200, default: 30", alma)
        self.assertNotIn("default 30", alma)
        self.assertIn("t show <thread_id> -n 8", alma)
        for name in ["tools.py", "client.py"]:
            text = (ROOT / "nowledge-mem-bub-plugin/src/nowledge_mem_bub" / name).read_text(encoding="utf-8")
            self.assertIn("limit: int = 8", text)

    def test_graph_expansion_remains_distinct(self):
        text = (ROOT / "nowledge-mem-codex-plugin/skills/search-memory/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("Progressive graph search", text)
        self.assertIn("maximum depth", text)

    def test_bub_client_default_and_explicit_range(self):
        path = ROOT / "nowledge-mem-bub-plugin/src/nowledge_mem_bub/client.py"
        spec = importlib.util.spec_from_file_location("bounded_bub_client", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        client = object.__new__(module.NmemClient)
        calls = []

        async def execute(*args):
            calls.append(args)
            return {}

        client._exec_json = execute
        asyncio.run(client.fetch_thread("thread-id"))
        asyncio.run(client.fetch_thread("thread-id", limit=12, offset=40))
        self.assertEqual(calls, [
            ("t", "show", "thread-id", "-n", "8", "--content-limit", "1200"),
            ("t", "show", "thread-id", "-n", "12", "--offset", "40", "--content-limit", "1200"),
        ])

    def test_live_prompt_injections_do_not_request_full_threads(self):
        for name in ["nowledge-mem-alma-plugin/main.js", "nowledge-mem-openclaw-plugin/src/hooks/behavioral.js", "nowledge-mem-bub-plugin/src/nowledge_mem_bub/plugin.py"]:
            with self.subTest(path=name):
                text = (ROOT / name).read_text(encoding="utf-8")
                self.assertNotIn("fetch the full conversation", text)
                self.assertNotIn("for full conversation context", text)
                self.assertNotRegex(text, r"(?i)(?:read|fetch|get) the full (?:conversation|thread)")
                self.assertNotIn("looking at the full conversation", text)
                self.assertNotIn("read the full context", text)
                self.assertIn("at most one small targeted message range per question", text)
                self.assertIn("report the evidence gap and refine search", text)

if __name__ == "__main__":
    unittest.main()
