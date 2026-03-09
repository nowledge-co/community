"""LongMemEval benchmark dataset loader.

Downloads and loads the LongMemEval dataset from HuggingFace.
6 question types: single-session-user, single-session-assistant,
single-session-preference, multi-session, temporal-reasoning, knowledge-update.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from .types import UnifiedMessage, UnifiedQuestion, UnifiedSession

logger = logging.getLogger(__name__)

HF_DATASET_URL = (
    "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned"
    "/resolve/main/longmemeval_s_cleaned.json"
)


def _parse_date(raw: str) -> tuple[str, str]:
    """Parse LongMemEval date format 'YYYY/MM/DD (day) HH:MM' → (iso, human)."""
    import re

    m = re.match(r"(\d{4})/(\d{2})/(\d{2})\s*\([^)]*\)\s*(\d{2}):(\d{2})", raw)
    if not m:
        return raw, raw
    y, mo, d, h, mi = m.groups()
    iso = f"{y}-{mo}-{d}T{h}:{mi}:00"
    # Human-readable
    months = [
        "", "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    month_name = months[int(mo)]
    hour = int(h)
    ampm = "am" if hour < 12 else "pm"
    hour_12 = hour % 12 or 12
    human = f"{hour_12}:{mi} {ampm} on {int(d)} {month_name}, {y}"
    return iso, human


class LongMemEvalBenchmark:
    """LongMemEval benchmark dataset manager."""

    def __init__(self, data_dir: Path | str | None = None):
        self.name = "longmemeval"
        self._data_dir = Path(data_dir) if data_dir else Path("data/longmemeval")
        self._items: list[dict[str, Any]] = []
        self._by_id: dict[str, dict[str, Any]] = {}  # question_id → item lookup

    def load(self) -> None:
        """Load (and download if needed) the LongMemEval dataset."""
        self._data_dir.mkdir(parents=True, exist_ok=True)
        data_file = self._data_dir / "longmemeval_s_cleaned.json"

        if not data_file.exists():
            self._download(data_file)

        with open(data_file) as f:
            self._items = json.load(f)

        self._by_id = {item["question_id"]: item for item in self._items}
        logger.info("Loaded LongMemEval: %d items", len(self._items))

    def _download(self, dest: Path) -> None:
        """Download dataset from HuggingFace."""
        import urllib.request

        logger.info("Downloading LongMemEval from %s ...", HF_DATASET_URL)
        urllib.request.urlretrieve(HF_DATASET_URL, dest)
        logger.info("Downloaded to %s", dest)

    def get_questions(
        self,
        question_type: str | None = None,
        limit: int | None = None,
    ) -> list[UnifiedQuestion]:
        """Get questions, optionally filtered by type."""
        questions = []
        for item in self._items:
            qid = item["question_id"]
            qtype = item.get("question_type", "unknown")

            if question_type and qtype != question_type:
                continue

            # Build haystack session IDs
            n_sessions = len(item.get("haystack_sessions", []))
            session_ids = [f"{qid}-session-{i}" for i in range(n_sessions)]

            questions.append(
                UnifiedQuestion(
                    question_id=qid,
                    question=item["question"],
                    ground_truth=item["answer"],
                    question_type=qtype,
                    haystack_session_ids=session_ids,
                    metadata={
                        "question_date": item.get("question_date", ""),
                    },
                )
            )

        if limit is not None:
            questions = questions[:limit]
        return questions

    def get_sessions(self, question_id: str) -> list[UnifiedSession]:
        """Get haystack sessions for a specific question."""
        item = self._find_item(question_id)
        if not item:
            return []

        sessions = []
        haystack = item.get("haystack_sessions", [])
        dates = item.get("haystack_dates", [])

        for i, msg_list in enumerate(haystack):
            date_raw = dates[i] if i < len(dates) else ""
            iso_date, human_date = _parse_date(date_raw) if date_raw else ("", "")

            messages = [
                UnifiedMessage(
                    role=m.get("role", "user"),
                    content=m.get("content", ""),
                )
                for m in msg_list
            ]

            sessions.append(
                UnifiedSession(
                    session_id=f"{question_id}-session-{i}",
                    messages=messages,
                    date=human_date,
                    metadata={"iso_date": iso_date, "question_id": question_id},
                )
            )

        return sessions

    def _find_item(self, question_id: str) -> dict[str, Any] | None:
        return self._by_id.get(question_id)

    def stats(self) -> dict[str, Any]:
        all_q = self.get_questions()
        type_counts: dict[str, int] = {}
        for q in all_q:
            type_counts[q.question_type] = type_counts.get(q.question_type, 0) + 1
        return {
            "total_questions": len(all_q),
            "by_type": type_counts,
        }
