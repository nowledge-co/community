import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RemoteMcpSyncGuidance(unittest.TestCase):
    def test_muse_uses_verified_guided_mcp_without_automatic_capture_claim(self):
        registry = json.loads((ROOT / "integrations.json").read_text(encoding="utf-8"))
        muse = next(entry for entry in registry["integrations"] if entry["id"] == "muse")
        self.assertEqual(muse["availability"], "guided")
        self.assertEqual(muse["transport"], "mcp")
        self.assertEqual(muse["threadSave"]["method"], "mcp-sync")
        self.assertFalse(muse["capabilities"]["workingMemory"])
        self.assertFalse(muse["capabilities"]["search"])
        self.assertFalse(muse["capabilities"]["autoCapture"])
        self.assertFalse(muse["capabilities"]["autoRecall"])
        for locale in ("prompt", "promptZh"):
            prompt = muse["install"]["agentGuide"][locale]
            for required in ("https://mem.nowledge.co/SKILL.md", "/docs/integrations/meta-muse", "Thread"):
                self.assertIn(required, prompt)

    def test_hosted_launcher_prompts_are_short_and_share_the_skill(self):
        registry_text = (ROOT / "integrations.json").read_text(encoding="utf-8")
        self.assertNotIn("daily sync is enabled", registry_text)
        self.assertNotIn("Confirm host scheduling support", registry_text)
        registry = json.loads(registry_text)
        for host in ("muse", "dots", "grok-bot"):
            guide = next(entry for entry in registry["integrations"] if entry["id"] == host)["install"]["agentGuide"]
            for key, limit in (("prompt", 900), ("promptZh", 400)):
                with self.subTest(host=host, locale=key):
                    self.assertLessEqual(len(guide[key]), limit)
                    self.assertIn("/docs/integrations/" + {"muse": "meta-muse", "dots": "openai-dots", "grok-bot": "grok-bot"}[host], guide[key])
                    self.assertNotIn("S256", guide[key])
                    required = ("OAuth", "含本轮回复", "同一 Thread", "每次回复", "实际状态", "总结你改了什么") if key == "promptZh" else ("OAuth", "including this reply", "same Thread", "After each reply", "actual sync status", "summarize what you changed")
                    for value in required:
                        self.assertIn(value, guide[key])

    def test_hosted_consumers_use_the_universal_skill_without_an_extra_dependency(self):
        registry_text = (ROOT / "integrations.json").read_text(encoding="utf-8")
        package_skill = (ROOT / "nowledge-mem-openai-plugin/skills/nowledge-mem/SKILL.md").read_text(encoding="utf-8")
        shared_guidance = (ROOT / "shared/behavioral-guidance.md").read_text(encoding="utf-8")
        for text in (registry_text, package_skill, shared_guidance):
            self.assertNotIn("shared/remote-mcp", text)
            self.assertNotIn("remote-mcp/SKILL.md", text)
            self.assertIn("https://mem.nowledge.co/SKILL.md", text)
        self.assertFalse((ROOT / "shared/remote-mcp/SKILL.md").exists())
        registry = json.loads(registry_text)
        for host in ("muse", "dots", "grok-bot", "chatgpt-cloud", "claude-cloud"):
            guide = next(entry for entry in registry["integrations"] if entry["id"] == host)["install"]["agentGuide"]
            for key in ("prompt", "promptZh"):
                with self.subTest(host=host, locale=key):
                    self.assertIn("https://mem.nowledge.co/SKILL.md", guide[key])

if __name__ == "__main__":
    unittest.main()
