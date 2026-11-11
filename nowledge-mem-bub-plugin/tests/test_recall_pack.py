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


def test_save_dates_are_not_represented_as_event_dates():
    block = recall_pack.format_recalled([
        {"title": "Schedule", "content": "The event date is unknown.", "created_at": "2026-11-07T00:00:00Z"},
    ])
    assert "[saved:2026-11-07]" in block
    assert "[2026-11-07]" not in block
    assert "a save date does not establish when an event happened" in block


_UPDATE = {
    "memory_id": "paused",
    "title": "Heartbeat paused",
    "relation": "enriches",
    "stated_at": "2026-10-29T08:00:00+00:00",
    "is_latest": True,
}
_OLDER = {
    "id": "cron",
    "title": "Heartbeat cron",
    "content": "heartbeat task runs 0 6-20 * * *",
    "source_recorded_at_start": "2026-10-01T09:00:00Z",
    "later_updates": [_UPDATE],
}


def test_updated_memory_names_its_newer_version_and_appends_it():
    lines = recall_pack.format_recalled([_OLDER]).splitlines()
    cron = next(i for i, line in enumerate(lines) if "[Heartbeat cron]" in line)
    assert lines[cron + 1] == "  → updated later (2026-10-29): Heartbeat paused"
    assert lines[-2] == (
        "- updated later (2026-10-29): Heartbeat paused "
        "(newer version of a memory above; id: paused)"
    )


def test_newer_version_already_recalled_is_not_appended_twice():
    newer = {"id": "paused", "title": "Heartbeat paused", "content": "paused since October 29"}
    block = recall_pack.format_recalled([_OLDER, newer])
    assert "newer version of a memory above" not in block
    assert "[Heartbeat paused] paused since October 29" in block


def test_appended_newer_version_carries_its_excerpt():
    older = dict(_OLDER, later_updates=[dict(_UPDATE, excerpt="paused   since\nOct 29")])
    block = recall_pack.format_recalled([older])
    assert "(newer version of a memory above; id: paused): paused since Oct 29" in block

def test_appended_newer_versions_are_newest_first():
    updates = [dict(_UPDATE, memory_id=f"n{d}", title=f"Update {d}", stated_at=f"2026-10-{d}") for d in ("03", "09", "05")]
    block = recall_pack.format_recalled([dict(_OLDER, later_updates=updates)])
    appended = [line for line in block.splitlines() if "newer version" in line]
    assert [line.split(": ")[1].split(" (")[0] for line in appended] == ["Update 09", "Update 05", "Update 03"]


def test_update_titles_stay_on_one_line():
    older = dict(_OLDER, later_updates=[dict(_UPDATE, title="Heartbeat\n\npaused")])
    lines = recall_pack.format_recalled([older]).splitlines()
    assert "  → updated later (2026-10-29): Heartbeat paused" in lines
