"""LoCoMo benchmark dataset loader.

Loads the LoCoMo dataset (ACL 2024) — 10 annotated long conversations
with 1986 QA pairs across 5 categories.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from .types import (
    LOCOMO_CATEGORY_NAMES,
    UnifiedMessage,
    UnifiedQuestion,
    UnifiedSession,
)

logger = logging.getLogger(__name__)

# Default path relative to the monorepo root
_DEFAULT_DATA_PATH = Path(__file__).resolve().parents[5] / "3pp" / "locomo" / "data" / "locomo10.json"


def load_locomo(data_path: Path | str | None = None) -> list[dict[str, Any]]:
    """Load raw LoCoMo JSON data."""
    path = Path(data_path) if data_path else _DEFAULT_DATA_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"LoCoMo dataset not found at {path}. "
            "Ensure 3pp/locomo/data/locomo10.json exists."
        )
    with open(path) as f:
        return json.load(f)


def extract_sessions(sample: dict[str, Any]) -> list[UnifiedSession]:
    """Extract UnifiedSessions from a single LoCoMo conversation sample."""
    conv = sample["conversation"]
    speaker_a = conv.get("speaker_a", "Speaker A")
    speaker_b = conv.get("speaker_b", "Speaker B")
    sample_id = sample["sample_id"]
    sessions = []

    # Sessions are numbered: session_1, session_2, ..., session_N
    session_num = 1
    while True:
        key = f"session_{session_num}"
        if key not in conv:
            break

        date_key = f"{key}_date_time"
        date = conv.get(date_key, "")
        turns = conv[key]

        messages = []
        for turn in turns:
            speaker = turn.get("speaker", "")
            messages.append(
                UnifiedMessage(
                    role="user" if speaker == speaker_a else "assistant",
                    content=turn.get("text", ""),
                    speaker=speaker,
                    dia_id=turn.get("dia_id", ""),
                )
            )

        sessions.append(
            UnifiedSession(
                session_id=f"{sample_id}-session_{session_num}",
                messages=messages,
                date=date,
                metadata={
                    "sample_id": sample_id,
                    "session_num": session_num,
                    "speaker_a": speaker_a,
                    "speaker_b": speaker_b,
                },
            )
        )
        session_num += 1

    return sessions


def extract_questions(sample: dict[str, Any]) -> list[UnifiedQuestion]:
    """Extract UnifiedQuestions from a single LoCoMo conversation sample."""
    sample_id = sample["sample_id"]
    questions = []

    for i, qa in enumerate(sample.get("qa", [])):
        cat = qa.get("category", 0)
        # Category 5 (adversarial) uses 'adversarial_answer' instead of 'answer'
        if "answer" in qa:
            ground_truth = str(qa["answer"])
        elif "adversarial_answer" in qa:
            ground_truth = str(qa["adversarial_answer"])
        else:
            ground_truth = ""

        questions.append(
            UnifiedQuestion(
                question_id=f"{sample_id}-q{i}",
                question=qa["question"],
                ground_truth=ground_truth,
                question_type=LOCOMO_CATEGORY_NAMES.get(cat, f"category-{cat}"),
                category=cat,
                evidence=qa.get("evidence", []),
                metadata={"sample_id": sample_id, "qa_index": i},
            )
        )

    return questions


class LoComoBenchmark:
    """LoCoMo benchmark dataset manager."""

    def __init__(self, data_path: Path | str | None = None):
        self.name = "locomo"
        self._data_path = data_path
        self._raw: list[dict[str, Any]] = []
        self._samples: dict[str, dict[str, Any]] = {}

    def load(self) -> None:
        """Load the LoCoMo dataset."""
        self._raw = load_locomo(self._data_path)
        self._samples = {s["sample_id"]: s for s in self._raw}
        logger.info("Loaded LoCoMo: %d conversations", len(self._raw))

    @property
    def sample_ids(self) -> list[str]:
        return list(self._samples.keys())

    def get_sessions(self, sample_id: str) -> list[UnifiedSession]:
        """Get all sessions for a conversation."""
        return extract_sessions(self._samples[sample_id])

    def get_questions(
        self,
        sample_id: str | None = None,
        category: int | None = None,
        limit: int | None = None,
    ) -> list[UnifiedQuestion]:
        """Get questions, optionally filtered by sample and/or category."""
        if sample_id:
            questions = extract_questions(self._samples[sample_id])
        else:
            questions = []
            for s in self._raw:
                questions.extend(extract_questions(s))

        if category is not None:
            questions = [q for q in questions if q.category == category]

        if limit is not None:
            questions = questions[:limit]

        return questions

    def get_all_sessions(self) -> dict[str, list[UnifiedSession]]:
        """Get all sessions grouped by sample_id."""
        return {sid: self.get_sessions(sid) for sid in self.sample_ids}

    def stats(self) -> dict[str, Any]:
        """Get dataset statistics."""
        all_q = self.get_questions()
        cat_counts: dict[str, int] = {}
        for q in all_q:
            cat_counts[q.question_type] = cat_counts.get(q.question_type, 0) + 1
        total_sessions = sum(
            len(self.get_sessions(sid)) for sid in self.sample_ids
        )
        return {
            "conversations": len(self._samples),
            "total_sessions": total_sessions,
            "total_questions": len(all_q),
            "by_category": cat_counts,
        }
