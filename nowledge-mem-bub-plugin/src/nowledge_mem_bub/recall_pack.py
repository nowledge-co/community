"""Per-turn recalled-knowledge block for Bub.

Whole memories are packed by character budget in rank order and each one is
dated. A 2026-11 third-party comparison
(https://github.com/nowledge-co/mem/issues/9940) showed that cutting every
memory to 300 characters dropped the concrete facts questions ask for, and
that undated memories failed every "how long ago" question.
"""

from __future__ import annotations

from datetime import datetime

RECALL_LIMIT = 10
RECALL_BUDGET_CHARS = 6000
RECALL_ITEM_CHARS = 1200


def recall_date(memory: dict) -> str:
    """Event date, else source-conversation date, else save date (YYYY-MM-DD)."""
    for key in ("event_start", "source_recorded_at_start", "created_at"):
        value = memory.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:10]
    return ""


def format_recalled(recalled: list) -> str:
    lines: list[str] = []
    used = 0
    for memory in recalled or []:
        if not isinstance(memory, dict):
            continue
        title = memory.get("title", "")
        text = (memory.get("content") or "").strip()
        if len(text) > RECALL_ITEM_CHARS:
            text = text[:RECALL_ITEM_CHARS].rstrip() + "…"
        date = recall_date(memory)
        entry = f"- {'[' + date + '] ' if date else ''}[{title}] {text}"
        if memory.get("id"):
            entry += f" (id: {memory['id']})"
        if memory.get("source_thread_id"):
            entry += f" (thread: {memory['source_thread_id']})"
        # Skip an item that would overflow and keep trying smaller ones.
        if used + len(entry) > RECALL_BUDGET_CHARS:
            continue
        used += len(entry)
        lines.append(entry)
    if not lines:
        return ""
    today = datetime.now().astimezone().date().isoformat()
    header = (
        f"Today is {today}. Bracketed dates are when the event happened or when the "
        "source conversation took place; prefer the newest entry when entries disagree."
    )
    return "<recalled-knowledge>\n" + header + "\n" + "\n".join(lines) + "\n</recalled-knowledge>"
