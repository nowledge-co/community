"""Checkpoint management for resumable benchmark runs."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class QuestionState:
    """Per-question checkpoint state."""

    question_id: str
    phase: str = "pending"  # pending | ingested | searched | answered | evaluated
    search_results: list[dict[str, Any]] = field(default_factory=list)
    search_latency_ms: float = 0
    answer: str = ""
    answer_latency_ms: float = 0
    f1_score: float = 0
    llm_judge_score: int = -1  # -1 = not evaluated
    llm_judge_label: str = ""
    llm_judge_explanation: str = ""
    retrieval_metrics: dict[str, float] = field(default_factory=dict)
    error: str = ""


@dataclass
class ConversationState:
    """Per-conversation checkpoint state (LoCoMo)."""

    sample_id: str
    phase: str = "pending"  # pending | ingested | distilled | processed
    thread_ids: list[str] = field(default_factory=list)
    memory_count_before: int = 0
    memory_count_after: int = 0


@dataclass
class RunCheckpoint:
    """Full benchmark run state."""

    run_id: str
    benchmark: str  # "locomo" | "longmemeval"
    search_mode: str = "normal"
    answer_model: str = "gpt-4o-mini"
    judge_model: str = "gpt-4o-mini"
    started_at: str = ""
    conversations: dict[str, ConversationState] = field(default_factory=dict)
    questions: dict[str, QuestionState] = field(default_factory=dict)
    save_path: Path | None = field(default=None, repr=False)

    def save(self, path: Path | None = None) -> None:
        path = path or self.save_path
        if path is None:
            raise ValueError("No save path set — pass path= or set checkpoint.save_path")
        path.parent.mkdir(parents=True, exist_ok=True)
        # Exclude save_path from serialization
        data = asdict(self)
        data.pop("save_path", None)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        logger.debug("Checkpoint saved: %s", path)

    @classmethod
    def load(cls, path: Path) -> RunCheckpoint:
        with open(path) as f:
            data = json.load(f)

        cp = cls(
            run_id=data["run_id"],
            benchmark=data["benchmark"],
            search_mode=data.get("search_mode", "normal"),
            answer_model=data.get("answer_model", "gpt-4o-mini"),
            judge_model=data.get("judge_model", "gpt-4o-mini"),
            started_at=data.get("started_at", ""),
            save_path=path,
        )

        for sid, cdata in data.get("conversations", {}).items():
            cp.conversations[sid] = ConversationState(**cdata)

        for qid, qdata in data.get("questions", {}).items():
            cp.questions[qid] = QuestionState(**qdata)

        return cp

    def get_question(self, qid: str) -> QuestionState:
        if qid not in self.questions:
            self.questions[qid] = QuestionState(question_id=qid)
        return self.questions[qid]

    def get_conversation(self, sid: str) -> ConversationState:
        if sid not in self.conversations:
            self.conversations[sid] = ConversationState(sample_id=sid)
        return self.conversations[sid]

    @property
    def completed_questions(self) -> list[QuestionState]:
        return [q for q in self.questions.values() if q.phase == "evaluated"]

    @property
    def pending_questions(self) -> list[str]:
        return [
            qid for qid, q in self.questions.items() if q.phase != "evaluated"
        ]
