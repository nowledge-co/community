"""Per-turn recall pack (https://github.com/nowledge-co/mem/issues/9940).

A third-party head-to-head showed the old prefetch injecting five memories cut
to 300 characters, with no dates and no conversation evidence, and returning
nothing at all for 20 of 120 questions. These tests pin the replacement.
"""

from __future__ import annotations

import sys
import unittest
from unittest import mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from test_search_importance import _load_provider_module  # noqa: E402

provider = _load_provider_module()
Provider = provider.NowledgeMemProvider


def _memory(title, content, score=0.9, **extra):
    return {"title": title, "content": content, "score": score, "labels": [], **extra}


def _thread_matches(*messages):
    return {"threads": [{"title": "Deployment", "matched_messages": list(messages)}]}


class RecallPackTests(unittest.TestCase):
    def test_whitespace_heavy_memory_keeps_the_fact_in_its_matching_passage(self):
        content = "Deployment context." + "\n " * 700 + "The production port is 8443."
        block = Provider._format_prefetch(
            {"memories": [_memory("Port", content, event_start="2026-11-01")]},
            _thread_matches({"snippet": content, "timestamp": "2026-11-01"}),
        )
        self.assertIn("The production port is 8443.", block)
        self.assertEqual(block.count("[2026-11-01]"), 1)

    def test_long_memory_is_not_cut_to_three_hundred_characters(self):
        fact = "发件域名是 play-chain.com。"
        content = "背景说明。" * 70 + fact
        block = Provider._format_prefetch({"memories": [_memory("可疑招聘邮件", content)]})
        self.assertIn("play-chain.com", block)

    def test_thread_passages_with_a_shared_prefix_keep_distinct_facts(self):
        prefix = "For the production deployment configuration discussed in the release checklist, "
        for new_date in ("2026-10-01", "2026-11-01"):
            with self.subTest(new_date=new_date):
                threads = _thread_matches(
                    {"snippet": prefix + "the production port is 443.", "timestamp": "2026-10-01"},
                    {"snippet": prefix + "the production port is now 8443.", "timestamp": new_date},
                )
                block = Provider._format_prefetch(None, threads)
                self.assertIn("port is 443.", block)
                self.assertIn("port is now 8443.", block)
                self.assertIn("[2026-10-01]", block)
                self.assertIn(f"[{new_date}]", block)

    def test_memory_does_not_suppress_a_passage_with_a_shared_prefix(self):
        prefix = "For the production deployment configuration discussed in the release checklist, "
        memories = {"memories": [_memory("Port", prefix + "the port is 443.")]}
        threads = _thread_matches({"snippet": prefix + "the port is now 8443."})
        block = Provider._format_prefetch(memories, threads)
        self.assertIn("the port is 443.", block)
        self.assertIn("the port is now 8443.", block)

    def test_identical_text_at_different_dates_remains_visible(self):
        text = "The release was approved."
        for source in ("memory", "thread"):
            with self.subTest(source=source):
                old_message = {"snippet": text, "timestamp": "2026-10-01"}
                new_message = {"snippet": text, "timestamp": "2026-11-01"}
                memories = (
                    {"memories": [_memory("Approval", text, event_start="2026-10-01")]}
                    if source == "memory" else None
                )
                threads = _thread_matches(
                    *([old_message] if source == "thread" else []), new_message,
                )
                block = Provider._format_prefetch(memories, threads)
                self.assertIn("[2026-10-01]", block)
                self.assertIn("[2026-11-01]", block)
                self.assertEqual(block.count(text), 2)

    def test_complete_duplicate_evidence_is_normalized_before_truncation(self):
        for source in ("memory", "thread"):
            for text in ("The port is 443.", "Deployment context. " * 100):
                with self.subTest(source=source, text_length=len(text)):
                    message = {"snippet": text, "timestamp": "2026-10-01"}
                    whitespace_variant = {
                        "snippet": text.replace(" ", " \n "),
                        "timestamp": "2026-10-01",
                    }
                    memories = (
                        {"memories": [_memory("Port", text, event_start="2026-10-01")]}
                        if source == "memory" else None
                    )
                    threads = _thread_matches(
                        *([message] if source == "thread" else []), whitespace_variant,
                    )
                    block = Provider._format_prefetch(memories, threads)
                    self.assertEqual(block.count("[2026-10-01]"), 1)
                    if source == "memory":
                        self.assertNotIn("### Conversation excerpts", block)

    def test_an_unpacked_memory_does_not_suppress_a_matching_passage(self):
        text = "The production port is 443."
        block = Provider._format_prefetch(
            {"memories": [_memory("Port", text)]},
            _thread_matches({"snippet": text}),
            memory_budget_chars=0,
        )
        self.assertIn("### Conversation excerpts", block)
        self.assertIn(text, block)

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

    def test_an_updated_memory_names_its_newer_version_and_the_newer_one_is_packed(self):
        update = {
            "memory_id": "paused",
            "title": "Heartbeat paused",
            "relation": "enriches",
            "stated_at": "2026-10-29T08:00:00+00:00",
            "is_latest": True,
        }
        older = _memory(
            "Heartbeat cron", "heartbeat task runs 0 6-20 * * *", id="cron",
            source_recorded_at_start="2026-10-01", later_updates=[update],
        )
        block = Provider._format_prefetch({"memories": [older]})
        lines = block.splitlines()
        cron = next(i for i, line in enumerate(lines) if "Heartbeat cron" in line)
        self.assertEqual(lines[cron + 1], "  → updated later (2026-10-29): Heartbeat paused")
        # The newer Memory was not a hit, so it is appended after the hits.
        self.assertEqual(
            lines[-1],
            "- updated later (2026-10-29): Heartbeat paused (newer version of a memory above)",
        )

        newer = _memory("Heartbeat paused", "paused since October 29", id="paused")
        block = Provider._format_prefetch({"memories": [older, newer]})
        self.assertNotIn("newer version of a memory above", block)
        self.assertIn("**Heartbeat paused**: paused since October 29", block)

    def test_appended_newer_versions_respect_the_budget_newest_first(self):
        updates = [
            {"memory_id": f"n{day}", "title": f"Update {day}", "stated_at": f"2026-10-{day}T00:00:00+00:00"}
            for day in ("03", "09", "05")
        ]
        older = _memory("Old", "x" * 50, id="old", later_updates=updates)
        block = Provider._format_prefetch({"memories": [older]})
        appended = [line for line in block.splitlines() if "newer version" in line]
        self.assertEqual([line.split(": ")[1].split(" (")[0] for line in appended],
                         ["Update 09", "Update 05", "Update 03"])
        # Room for one more line: the newest version wins it.
        tight = Provider._format_prefetch({"memories": [older]}, memory_budget_chars=300)
        appended = [line for line in tight.splitlines() if "newer version" in line]
        self.assertEqual(len(appended), 1)
        self.assertIn("Update 09", appended[0])
        self.assertIn("**Old**", tight)
        # The note lines are part of the item: nothing is appended without them.
        none = Provider._format_prefetch({"memories": [older]}, memory_budget_chars=100)
        self.assertNotIn("Update", none)

    def test_appended_newer_version_carries_its_excerpt_and_drops_it_before_itself(self):
        update = {
            "memory_id": "paused", "title": "Heartbeat paused",
            "stated_at": "2026-10-29T08:00:00+00:00", "excerpt": "Heartbeat  task\npaused since Oct 29.",
        }
        older = _memory("Heartbeat cron", "runs 0 6-20 * * *", id="cron", later_updates=[update])
        block = Provider._format_prefetch({"memories": [older]})
        self.assertEqual(
            block.splitlines()[-1],
            "- updated later (2026-10-29): Heartbeat paused (newer version of a memory above): "
            "Heartbeat task paused since Oct 29.",
        )
        full = len(Provider._format_prefetch({"memories": [older]}, memory_budget_chars=6000).split("### Memories\n")[1])
        tight = Provider._format_prefetch({"memories": [older]}, memory_budget_chars=full - 5)
        self.assertEqual(
            tight.splitlines()[-1],
            "- updated later (2026-10-29): Heartbeat paused (newer version of a memory above)",
        )

    def test_empty_inputs_inject_nothing(self):
        self.assertEqual(Provider._format_prefetch({"memories": []}, {"threads": []}), "")
        self.assertEqual(Provider._format_prefetch(None, None), "")

    def test_save_time_is_not_presented_as_an_event_time(self):
        block = Provider._format_prefetch({"memories": [
            _memory("Schedule", "The exam date has not been confirmed.", created_at="2026-11-07T00:00:00Z"),
        ]})
        self.assertIn("[saved:2026-11-07]", block)
        self.assertNotIn("[2026-11-07]", block)
        self.assertIn("do not establish when an event happened", block)
        self.assertNotIn("prefer the newest", block)

    def test_count_only_thread_results_do_not_break_memory_recall(self):
        block = Provider._format_prefetch(
            {"memories": [_memory("Fact", "A verified fact.")]},
            {"threads": [{"title": "Legacy result", "matched_messages": 2}]},
        )
        self.assertIn("A verified fact.", block)
        self.assertNotIn("### Conversation excerpts", block)

    def test_a_smaller_budget_packs_only_whole_items_that_fit(self):
        block = Provider._format_prefetch(
            {"memories": [_memory("Large", "x" * 500), _memory("Small", "The answer is 42.")]},
            memory_budget_chars=80,
        )
        self.assertNotIn("Large", block)
        self.assertIn("The answer is 42.", block)
        self.assertLessEqual(len(block.split("### Memories\n")[1]), 80)

    def test_zero_budgets_skip_the_disabled_reads(self):
        instance = Provider()
        instance._client = mock.Mock()
        instance._recall_memory_budget = 0
        instance._recall_thread_budget = 0
        self.assertEqual(instance.prefetch("Which facts do we know?"), "")
        instance._client.search.assert_not_called()
        instance._client.thread_search.assert_not_called()

        instance._recall_memory_budget = 80
        instance._client.search.return_value = {"memories": [_memory("Fact", "Known value.")]}
        self.assertIn("Known value.", instance.prefetch("Which facts do we know?"))
        instance._client.thread_search.assert_not_called()

    def test_budget_configuration_cannot_exceed_the_default_ceiling(self):
        self.assertEqual(Provider._recall_budget("120", 6000), 120)
        self.assertEqual(Provider._recall_budget(0, 6000), 0)
        self.assertEqual(Provider._recall_budget(-1, 6000), 0)
        self.assertEqual(Provider._recall_budget(9000, 6000), 6000)
        for value in (None, True, "invalid", float("inf")):
            self.assertEqual(Provider._recall_budget(value, 6000), 6000)

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
        clock = [0.0]

        class _Client:
            def __init__(self, timeout, space=None):
                pass

            def health(self):
                clock[0] += 2.0
                return True

            def context_bundle(self, **kwargs):
                seen["context_bundle"] = kwargs.get("timeout")
                clock[0] += 4.0
                return {}

            def working_memory(self, **kwargs):
                seen["working_memory"] = kwargs.get("timeout")
                return {}

        original = provider.NowledgeMemClient
        try:
            provider.NowledgeMemClient = _Client
            instance = Provider()
            instance._load_config = lambda _home: {"recall_memory_budget_chars": 300, "recall_thread_budget_chars": 0}
            with mock.patch.object(provider.time, "monotonic", side_effect=lambda: clock[0]):
                instance.initialize("session-1", hermes_home="", platform="cli")
        finally:
            provider.NowledgeMemClient = original
        self.assertEqual(seen["context_bundle"], 6.0)
        self.assertEqual(seen["working_memory"], 2.0)
        self.assertEqual(instance._recall_memory_budget, 300)
        self.assertEqual(instance._recall_thread_budget, 0)

    def test_an_exhausted_startup_budget_does_not_start_a_fallback(self):
        clock = [0.0]
        client = mock.Mock()
        client.health.return_value = True

        def exhaust(**kwargs):
            clock[0] += kwargs["timeout"]
            raise RuntimeError("timeout")

        client.context_bundle.side_effect = exhaust
        instance = Provider()
        instance._load_config = lambda _home: {}
        with mock.patch.object(provider, "NowledgeMemClient", return_value=client), \
             mock.patch.object(provider.time, "monotonic", side_effect=lambda: clock[0]):
            instance.initialize("session-1", hermes_home="", platform="cli")
        client.working_memory.assert_not_called()

    def test_configured_cli_path_wins_over_path(self):
        import os
        import stat
        import tempfile

        client_module = sys.modules["nowledge_mem_hermes.client"]
        with tempfile.TemporaryDirectory() as root:
            configured = Path(root) / "nmem-configured"
            configured.write_text("#!/bin/sh\n")
            configured.chmod(configured.stat().st_mode | stat.S_IXUSR)
            previous = os.environ.get("NMEM_CLI_PATH")
            original_which = client_module.shutil.which
            try:
                os.environ["NMEM_CLI_PATH"] = str(configured)
                client_module.shutil.which = lambda _name: "/usr/local/bin/nmem"
                self.assertEqual(client_module._resolve_nmem(), str(configured))
            finally:
                client_module.shutil.which = original_which
                if previous is None:
                    os.environ.pop("NMEM_CLI_PATH", None)
                else:
                    os.environ["NMEM_CLI_PATH"] = previous

    def test_a_missing_explicit_cli_does_not_fall_back_to_another_binary(self):
        import os
        import tempfile

        client_module = sys.modules["nowledge_mem_hermes.client"]
        with tempfile.TemporaryDirectory() as root, \
             mock.patch.dict(os.environ, {"NMEM_CLI_PATH": str(Path(root) / "missing")}), \
             mock.patch.object(client_module.shutil, "which", return_value="/old/nmem") as which:
            self.assertIsNone(client_module._resolve_nmem())
            which.assert_not_called()


if __name__ == "__main__":
    unittest.main()
