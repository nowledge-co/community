"""Per-turn recall pack (https://github.com/nowledge-co/mem/issues/9940).

A third-party head-to-head showed the old prefetch injecting five memories cut
to 300 characters, with no dates and no conversation evidence, and returning
nothing at all for 20 of 120 questions. These tests pin the replacement.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from test_search_importance import _load_provider_module  # noqa: E402

provider = _load_provider_module()
Provider = provider.NowledgeMemProvider


def _memory(title, content, score=0.9, **extra):
    return {"title": title, "content": content, "score": score, "labels": [], **extra}


class RecallPackTests(unittest.TestCase):
    def test_long_memory_is_not_cut_to_three_hundred_characters(self):
        fact = "发件域名是 play-chain.com。"
        content = "背景说明。" * 70 + fact
        block = Provider._format_prefetch({"memories": [_memory("可疑招聘邮件", content)]})
        self.assertIn("play-chain.com", block)

    def test_items_carry_event_or_conversation_dates(self):
        block = Provider._format_prefetch(
            {
                "memories": [
                    _memory("软考", "中项考试已考完", event_start="2026-10-24"),
                    _memory(
                        "备份任务暂停",
                        "每日备份任务已暂停",
                        source_recorded_at_start="2026-10-29T08:00:00+00:00",
                        created_at="2026-11-07T00:00:00+00:00",
                    ),
                ]
            }
        )
        self.assertIn("[2026-10-24] **软考**", block)
        self.assertIn("[2026-10-29] **备份任务暂停**", block)
        self.assertNotIn("2026-11-07", block)
        self.assertIn("Today is ", block)

    def test_moderate_scores_are_kept_and_noise_is_dropped(self):
        block = Provider._format_prefetch(
            {
                "memories": [
                    _memory("relevant", "kept at a moderate score", score=0.22),
                    _memory("noise", "dropped", score=0.05),
                ]
            }
        )
        self.assertIn("relevant", block)
        self.assertNotIn("noise", block)

    def test_budget_packs_whole_items_and_skips_one_that_overflows(self):
        big = "x" * provider.RECALL_MEMORY_ITEM_CHARS
        memories = [_memory(f"m{i}", big) for i in range(8)]
        memories.append(_memory("small", "still fits"))
        block = Provider._format_prefetch({"memories": memories})
        memory_section = block.split("### Memories\n", 1)[1]
        self.assertLessEqual(len(memory_section), provider.RECALL_MEMORY_BUDGET_CHARS + 16)
        self.assertIn("small", block)

    def test_conversation_excerpts_fill_in_when_memories_are_missing(self):
        threads = {
            "threads": [
                {
                    "title": "Fastmail 整理",
                    "last_activity": "2026-08-30",
                    "matched_messages": [
                        {
                            "role": "user",
                            "snippet": "…那封邮件来自 play-chain.com，帮我举报…",
                            "timestamp": "2026-08-26T09:00:00Z",
                        }
                    ],
                }
            ]
        }
        block = Provider._format_prefetch({"memories": []}, threads)
        self.assertIn("### Conversation excerpts", block)
        self.assertIn("[2026-08-26] Fastmail 整理 (user)", block)
        self.assertIn("play-chain.com", block)

    def test_empty_inputs_inject_nothing(self):
        self.assertEqual(Provider._format_prefetch({"memories": []}, {"threads": []}), "")
        self.assertEqual(Provider._format_prefetch(None, None), "")

    def test_short_chinese_question_triggers_recall(self):
        self.assertTrue(Provider._is_recall_query("我的软考是哪天考的？"))
        self.assertTrue(Provider._is_recall_query("软考哪天考"))
        self.assertFalse(Provider._is_recall_query("ok"))
        self.assertFalse(Provider._is_recall_query("好的"))

    def test_prefetch_reads_memories_and_threads_with_a_tight_timeout(self):
        calls = []

        class _Client:
            def search(self, query, **kwargs):
                calls.append(("search", kwargs))
                return {"memories": [_memory("软考", "中项考试 2026-10-24")]}

            def thread_search(self, query, **kwargs):
                calls.append(("thread_search", kwargs))
                raise RuntimeError("thread index unavailable")

        instance = Provider()
        instance._client = _Client()
        block = instance.prefetch("我的软考是哪天考的？")
        self.assertIn("软考", block)
        kinds = {kind for kind, _ in calls}
        self.assertEqual(kinds, {"search", "thread_search"})
        for _, kwargs in calls:
            self.assertEqual(kwargs["timeout"], provider.RECALL_TIMEOUT_SECONDS)

    def test_session_start_reads_are_bounded(self):
        seen = {}

        class _Client:
            def __init__(self, timeout, space=None):
                pass

            def health(self):
                return True

            def context_bundle(self, **kwargs):
                seen["context_bundle"] = kwargs.get("timeout")
                return {}

            def working_memory(self, **kwargs):
                seen["working_memory"] = kwargs.get("timeout")
                return {}

        original = provider.NowledgeMemClient
        try:
            provider.NowledgeMemClient = _Client
            instance = Provider()
            instance._load_config = lambda _home: {}
            instance.initialize("session-1", hermes_home="", platform="cli")
        finally:
            provider.NowledgeMemClient = original
        self.assertEqual(seen["context_bundle"], provider.STARTUP_TIMEOUT_SECONDS)
        self.assertEqual(seen["working_memory"], provider.STARTUP_TIMEOUT_SECONDS)


if __name__ == "__main__":
    unittest.main()
