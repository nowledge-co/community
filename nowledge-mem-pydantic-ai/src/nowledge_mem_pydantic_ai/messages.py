"""Visible-message capture; model history remains owned by Pydantic AI."""

from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import replace
from typing import Any

from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    TextContent,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)

CONTEXT_METADATA = "nowledge_mem_context"
_CREDENTIAL = re.compile(
    r"(?i)(\b(?:api[_-]?key|access[_-]?token|authorization|password|secret)\b"
    r"[\"']?\s*[:=]\s*[\"']?)([^\s\"',;}]+)"
)
_BEARER = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")


def bounded_text(text: str, max_bytes: int) -> str:
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    suffix = "\n[truncated]"
    return encoded[: max_bytes - len(suffix)].decode("utf-8", errors="ignore") + suffix


def visible_user_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, Sequence):
        return "\n".join(
            part if isinstance(part, str) else part.content
            for part in content
            if isinstance(part, (str, TextContent))
        )
    return ""


def is_context(content: Any, owner_id: str | None = None) -> bool:
    if not isinstance(content, TextContent) or not isinstance(content.metadata, dict):
        return False
    marker = content.metadata.get(CONTEXT_METADATA)
    return bool(marker) if owner_id is None else marker == owner_id


def without_context(
    messages: Sequence[ModelMessage], owner_id: str | None = None
) -> list[ModelMessage]:
    cleaned: list[ModelMessage] = []
    for message in messages:
        if not isinstance(message, ModelRequest):
            cleaned.append(message)
            continue
        parts = []
        for part in message.parts:
            if isinstance(part, UserPromptPart) and not isinstance(part.content, str):
                content = [value for value in part.content if not is_context(value, owner_id)]
                if content:
                    parts.append(replace(part, content=content))
            else:
                parts.append(part)
        if parts:
            cleaned.append(replace(message, parts=parts))
    return cleaned


def normalize_messages(
    messages: Sequence[ModelMessage],
    *,
    output_tools: set[str],
    max_bytes: int,
    secrets: Sequence[str] = (),
) -> list[dict[str, Any]]:
    """Capture text and structured final answers, never reasoning or retrieval results."""
    normalized: list[dict[str, Any]] = []
    occurrences: defaultdict[str, int] = defaultdict(int)
    pending_outputs: dict[str, ToolCallPart] = {}
    accepted_outputs: set[int] = set()
    for message in messages:
        for part in message.parts:
            if isinstance(part, ToolCallPart) and part.tool_name in output_tools:
                pending_outputs[part.tool_call_id] = part
            elif isinstance(part, ToolReturnPart):
                call = pending_outputs.pop(part.tool_call_id, None)
                # The SDK records skipped and rejected output tools as well.
                # Capture only its accepted final result (covered by SDK tests).
                if call is not None and part.content == "Final result processed.":
                    accepted_outputs.add(id(call))
    for message in without_context(messages):
        pieces: list[str] = []
        for part in message.parts:
            if isinstance(part, UserPromptPart):
                pieces.append(visible_user_text(part.content))
            elif isinstance(part, TextPart):
                pieces.append(part.content)
            elif isinstance(part, ToolCallPart) and id(part) in accepted_outputs:
                pieces.append(json.dumps(part.args_as_dict(), ensure_ascii=False, sort_keys=True))
        content = "\n".join(piece for piece in pieces if piece).strip()
        if not content:
            continue
        for secret in secrets:
            if secret:
                content = content.replace(secret, "[REDACTED]")
        content = _CREDENTIAL.sub(r"\1[REDACTED]", _BEARER.sub("Bearer [REDACTED]", content))
        role = "user" if isinstance(message, ModelRequest) else "assistant"
        # Pydantic AI may reassign a merged request's run_id when history is reused.
        # Original user-part timestamps and response timestamps survive that merge.
        timestamps = (
            [
                part.timestamp.isoformat()
                for part in message.parts
                if isinstance(part, UserPromptPart)
            ]
            if isinstance(message, ModelRequest)
            else [message.timestamp.isoformat()]
        )
        identity = json.dumps([timestamps, role, content], ensure_ascii=False)
        digest = hashlib.sha256(identity.encode()).hexdigest()
        occurrence = occurrences[digest]
        occurrences[digest] += 1
        metadata: dict[str, Any] = {"external_id": f"pydantic-ai:{digest}:{occurrence}"}
        if len(content.encode()) > max_bytes:
            metadata["truncated"] = True
        normalized.append(
            {"role": role, "content": bounded_text(content, max_bytes), "metadata": metadata}
        )
    return normalized
