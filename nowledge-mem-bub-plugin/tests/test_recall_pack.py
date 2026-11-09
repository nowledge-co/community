"""https://github.com/nowledge-co/mem/issues/9940: recalled memories keep their facts and dates."""

import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "recall_pack", Path(__file__).resolve().parents[1] / "src/nowledge_mem_bub/recall_pack.py"
)
recall_pack = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(recall_pack)


def test_fact_deep_in_a_long_memory_survives_and_is_dated():
    content = "背景说明。" * 60 + "发件域名是 play-chain.com。"
    block = recall_pack.format_recalled(
        [{"title": "可疑招聘邮件", "content": content, "source_recorded_at_start": "2026-08-26T09:00:00Z",
          "created_at": "2026-11-07T00:00:00Z"}]
    )
    assert "play-chain.com" in block
    assert "[2026-08-26] [可疑招聘邮件]" in block
    assert "2026-11-07" not in block
    assert "Today is " in block


def test_block_respects_budget_and_admits_smaller_items():
    items = [{"title": f"m{i}", "content": "x" * 1500} for i in range(10)]
    items.append({"title": "small", "content": "fits"})
    block = recall_pack.format_recalled(items)
    assert len(block) <= recall_pack.RECALL_BUDGET_CHARS + 400
    assert "small" in block


def test_empty_recall_injects_nothing():
    assert recall_pack.format_recalled([]) == ""
