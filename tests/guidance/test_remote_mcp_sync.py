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
            for required in ("shared/remote-mcp/SKILL.md", "S256", "Threads"):
                self.assertIn(required, prompt)
        skill = (ROOT / "shared/remote-mcp/SKILL.md").read_text(encoding="utf-8")
        for required in ("240 seconds", "User-Agent", "WWW-Authenticate", "Mcp-Session-Id", "credentials.request_api_access"):
            self.assertIn(required, skill)

    def test_daily_sync_requires_host_scope_and_a_confirmed_task(self):
        text = (ROOT / "shared/remote-mcp/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("once a day", text)
        self.assertIn("timezone", text)
        self.assertIn("which", text)
        self.assertIn("conversations to include", text)
        self.assertIn("target Space", text)
        self.assertIn("confirms a real task", text)
        self.assertIn("daily sync is not enabled", text)
        self.assertIn("Threads", text)
        self.assertIn("A summary is not an original", text)

    def test_original_snapshot_receipt_controls_checkpoint_and_retry(self):
        text = (ROOT / "shared/remote-mcp/SKILL.md").read_text(encoding="utf-8")
        for required in ("threads:sync", "threads:read", "full ordered snapshot",
                         "stable", "snapshot_saved: true", "only after", "same IDs",
                         "space_id", "8 MiB"):
            with self.subTest(required=required):
                self.assertIn(required, text)


if __name__ == "__main__":
    unittest.main()
