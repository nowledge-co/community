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
        skill = (ROOT / "shared/remote-mcp/SKILL.md").read_text(encoding="utf-8")
        for required in ("240 seconds", "User-Agent", "WWW-Authenticate", "Mcp-Session-Id", "credentials.request_api_access"):
            self.assertIn(required, skill)

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

    def test_per_reply_sync_requires_originals_and_no_recursive_calls(self):
        text = (ROOT / "shared/remote-mcp/SKILL.md").read_text(encoding="utf-8")
        for value in ("each normal assistant reply", "this assistant reply", "same Thread",
                      "must not trigger another reply/sync", "not required by default",
                      "automatic reply sync is not enabled", "full ordered"):
            self.assertIn(value, text)

    def test_original_snapshot_receipt_controls_checkpoint_and_retry(self):
        text = (ROOT / "shared/remote-mcp/SKILL.md").read_text(encoding="utf-8")
        for required in ("threads:sync", "threads:read", "full ordered snapshot",
                         "stable", "snapshot_saved: true", "only after", "same IDs",
                         "space_id", "8 MiB"):
            with self.subTest(required=required):
                self.assertIn(required, text)


if __name__ == "__main__":
    unittest.main()
