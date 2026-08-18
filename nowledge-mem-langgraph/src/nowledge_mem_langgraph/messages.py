"""LangChain message normalization for idempotent Mem Thread import."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from collections.abc import Iterable, Mapping
from typing import Any

from langchain_core.messages import BaseMessage

AcknowledgedCursor = tuple[int, str]

NOWLEDGE_TOOL_NAMES = frozenset(
    {
        "read_context_bundle",
        "read_working_memory",
        "memory_search",
        "get_memory_by_id",
        "memory_add",
        "memory_update",
        "thread_search",
        "thread_fetch_messages",
        "mem_fs",
        "find_skills",
        "report_skill_outcome",
        "list_timeline_reviews",
        "resolve_timeline_review",
        "memory_evolves_revise",
        "check_claims",
        "trigger_memory_catchup",
    }
)


def _text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, Mapping) and block.get("type") in {"text", "text_delta"}:
                value = block.get("text")
                if isinstance(value, str):
                    parts.append(value)
        if parts:
            return "\n".join(parts)
    return json.dumps(content, ensure_ascii=False, sort_keys=True, default=str)


def _role(message: BaseMessage) -> str:
    return {
        "human": "user",
        "ai": "assistant",
        "tool": "tool",
        "system": "system",
    }.get(message.type, message.type or "user")


def _tool_names(messages: Iterable[BaseMessage]) -> dict[str, str]:
    names: dict[str, str] = {}
    for message in messages:
        for call in getattr(message, "tool_calls", None) or []:
            call_id = call.get("id") if isinstance(call, Mapping) else None
            name = call.get("name") if isinstance(call, Mapping) else None
            if call_id and name:
                names[str(call_id)] = str(name)
    return names


def normalize_messages(messages: Iterable[BaseMessage]) -> list[dict[str, Any]]:
    """Convert LangChain messages while keeping Mem retrieval out of distillation."""

    source = list(messages)
    call_names = _tool_names(source)
    occurrences: defaultdict[str, int] = defaultdict(int)
    normalized: list[dict[str, Any]] = []

    for message in source:
        role = _role(message)
        content = _text(message.content)
        tool_call_id = getattr(message, "tool_call_id", None)
        tool_name = getattr(message, "name", None) or call_names.get(str(tool_call_id or ""))
        metadata: dict[str, Any] = {"langgraph_message_type": message.type}
        if tool_call_id:
            metadata["tool_call_id"] = str(tool_call_id)
        if tool_name:
            metadata["tool_name"] = str(tool_name)

        # System prompts and Mem's own retrieval payload are useful in the exact
        # Thread view, but must never become new Memories on the next distillation.
        if role in {"system", "developer"} or tool_name in NOWLEDGE_TOOL_NAMES:
            metadata["exclude_from_distillation"] = True
        if tool_name in NOWLEDGE_TOOL_NAMES:
            metadata["external_context"] = True
            metadata["external_context_source"] = "nowledge-mem"

        message_id = str(message.id).strip() if message.id else ""
        if not message_id:
            fingerprint = hashlib.sha256(f"{role}\0{content}".encode()).hexdigest()[:24]
            occurrence = occurrences[fingerprint]
            occurrences[fingerprint] += 1
            message_id = f"sha256:{fingerprint}:{occurrence}"
        metadata["external_id"] = f"langgraph:{message_id}"
        normalized.append({"role": role, "content": content, "metadata": metadata})
    return normalized


def select_acknowledged_delta(
    messages: list[dict[str, Any]], cursor: AcknowledgedCursor | None
) -> tuple[list[dict[str, Any]], AcknowledgedCursor, bool]:
    """Return the suffix after a verified remote acknowledgement anchor."""

    start = cursor[0] if cursor is not None else 0
    reset = False
    if (
        start < 0
        or start > len(messages)
        or (start > 0 and messages[start - 1].get("metadata", {}).get("external_id") != cursor[1])
    ):
        start = 0
        reset = True
    end = len(messages)
    last_external_id = (
        str(messages[-1].get("metadata", {}).get("external_id", "")) if messages else ""
    )
    return messages[start:], (end, last_external_id), reset


def default_title(messages: Iterable[BaseMessage]) -> str:
    for message in messages:
        if _role(message) == "user":
            text = " ".join(_text(message.content).split())
            if text:
                return text[:77] + ("..." if len(text) > 77 else "")
    return "LangGraph thread"
