import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RemoteMcpSyncGuidance(unittest.TestCase):
    def test_pending_muse_does_not_advertise_a_verified_protocol(self):
        registry = json.loads((ROOT / "integrations.json").read_text(encoding="utf-8"))
        muse = next(entry for entry in registry["integrations"] if entry["id"] == "muse")
        self.assertEqual(muse["availability"], "pending-verification")
        self.assertNotIn("transport", muse)
        self.assertNotIn("toolNaming", muse)
        self.assertFalse(any(muse["capabilities"].values()))
        for locale in ("prompt", "promptZh"):
            prompt = muse["install"]["agentGuide"][locale]
            self.assertIn("shared/remote-mcp/SKILL.md", prompt)
            self.assertRegex(prompt, r"Do not connect|不要连接")

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
