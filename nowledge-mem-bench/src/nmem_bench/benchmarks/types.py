"""Unified data types for benchmark datasets."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class UnifiedMessage:
    role: str  # "user" | "assistant" | "system"
    content: str
    speaker: str = ""
    dia_id: str = ""  # LoCoMo dialogue ID, e.g. "D1:3"


@dataclass
class UnifiedSession:
    session_id: str
    messages: list[UnifiedMessage]
    date: str = ""  # ISO date or human-readable
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_markdown(self) -> str:
        """Format session as conversation markdown for thread creation."""
        lines = []
        if self.date:
            lines.append(f"**Date**: {self.date}\n")
        for msg in self.messages:
            speaker = msg.speaker or msg.role.capitalize()
            lines.append(f"**{speaker}**: {msg.content}")
        return "\n\n".join(lines)


@dataclass
class UnifiedQuestion:
    question_id: str
    question: str
    ground_truth: str
    question_type: str  # e.g. "single-hop", "multi-hop", "temporal"
    category: int = 0  # LoCoMo numeric category (1-5)
    evidence: list[str] = field(default_factory=list)  # dialogue IDs for retrieval recall
    haystack_session_ids: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


LOCOMO_CATEGORY_NAMES = {
    1: "multi-hop",
    2: "single-hop",
    3: "temporal",
    4: "open-domain",
    5: "adversarial",
}

LONGMEMEVAL_QUESTION_TYPES = [
    "single-session-user",
    "single-session-assistant",
    "single-session-preference",
    "multi-session",
    "temporal-reasoning",
    "knowledge-update",
]
