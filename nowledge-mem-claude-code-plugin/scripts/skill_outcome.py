"""Extract Nowledge Mem managed-skill use from host transcripts.

The extractor is deliberately conservative: it only reports structured
`find_skills` tool results with skill-style ids. Missing versions default to
version 1 for matching skill records. It does not regex free-form assistant
text, so normal conversation cannot create false skill outcome records.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Iterable

SkillOutcome = tuple[str, str]

_RESULT_KEYS = (
    "result",
    "response",
    "output",
    "outputs",
    "content",
    "data",
    "tool_result",
)
_CALL_ID_KEYS = (
    "id",
    "call_id",
    "callId",
    "tool_call_id",
    "toolCallId",
    "tool_use_id",
    "toolUseId",
    "invocation_id",
    "invocationId",
)


# Optional telemetry must not scale its live heap with session history.
MAX_RECORD_BYTES = 2 * 1024 * 1024
MAX_TRACKED_REFS = 4096
MAX_REF_CHARS = 512
SCAN_BUDGET_SECONDS = 4.0


class _ScanLimit(Exception):
    pass


def load_json_records(handle, end: int, check) -> Iterable[Any]:
    """Read a fixed prefix twice without retaining unrelated records.

    Pretty JSON remains supported only within the same single-record budget.
    A record that exceeds the budget aborts optional telemetry, never capture.
    """
    handle.seek(0)
    any_records = False
    while handle.tell() < end:
        check()
        raw = handle.readline(min(MAX_RECORD_BYTES + 1, end - handle.tell()))
        if len(raw) > MAX_RECORD_BYTES:
            raise _ScanLimit("record size limit")
        text = raw.strip()
        if not text or text[:1] not in (b"[", b"{"):
            continue
        try:
            record = json.loads(text)
        except (ValueError, RecursionError):
            continue
        any_records = True
        yield record
    if not any_records and end <= MAX_RECORD_BYTES:
        check()
        handle.seek(0)
        try:
            yield json.loads(handle.read(end))
        except (ValueError, RecursionError):
            return


def extract_skill_outcomes(records: Iterable[Any]) -> list[SkillOutcome]:
    materialized = list(records)
    find_call_ids: set[str] = set()
    found: list[SkillOutcome] = []

    for node in _walk(materialized):
        if not isinstance(node, dict) or not _is_find_skills_node(node):
            continue
        call_id = _call_id(node)
        if call_id:
            find_call_ids.add(call_id)
        found.extend(_extract_skill_refs(_result_payload(node)))

    if find_call_ids:
        for node in _walk(materialized):
            if not isinstance(node, dict):
                continue
            call_id = _call_id(node)
            if call_id and call_id in find_call_ids:
                found.extend(_extract_skill_refs(_result_payload(node)))

    return _dedupe(found)


def extract_skill_outcomes_from_file(path: str | None, heartbeat=None) -> list[SkillOutcome]:
    if not path:
        return []
    deadline = time.monotonic() + SCAN_BUDGET_SECONDS
    last_heartbeat = 0.0

    def check():
        nonlocal last_heartbeat
        now = time.monotonic()
        if now >= deadline:
            raise _ScanLimit("scan time limit")
        if heartbeat is not None and now - last_heartbeat >= 1.0:
            heartbeat()
            last_heartbeat = now

    def bounded_ref(value):
        if len(value) > MAX_REF_CHARS:
            raise _ScanLimit("reference size limit")
        return value

    call_ids: set[str] = set()
    found: dict[SkillOutcome, None] = {}

    def collect(node):
        for skill_id, version in _extract_skill_refs(_result_payload(node)):
            found[(bounded_ref(skill_id), bounded_ref(version))] = None
            if len(found) > MAX_TRACKED_REFS:
                raise _ScanLimit("outcome count limit")

    try:
        with Path(path).expanduser().open("rb") as handle:
            before = os.fstat(handle.fileno())
            for record in load_json_records(handle, before.st_size, check):
                for node in _walk(record):
                    check()
                    if isinstance(node, dict) and _is_find_skills_node(node):
                        call_id = _call_id(node)
                        if call_id:
                            call_ids.add(bounded_ref(call_id))
                            if len(call_ids) > MAX_TRACKED_REFS:
                                raise _ScanLimit("call count limit")
                        collect(node)
            if call_ids:
                for record in load_json_records(handle, before.st_size, check):
                    for node in _walk(record):
                        check()
                        if isinstance(node, dict) and _call_id(node) in call_ids:
                            collect(node)
            after = os.fstat(handle.fileno())
            if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
                raise _ScanLimit("transcript changed during scan")
            check()
    except OSError:
        return []
    except (_ScanLimit, RecursionError) as exc:
        reason = str(exc) if isinstance(exc, _ScanLimit) else "nesting limit"
        print(f"nowledge-mem: optional skill outcomes skipped: {reason}", file=sys.stderr)
        return []
    return list(found)


def build_outcome_args(
    skill_id: str,
    version: str,
    *,
    outcome: str = "completed",
) -> list[str]:
    return [
        "skills",
        "outcome",
        skill_id,
        "--version",
        version,
        "--outcome",
        outcome,
    ]


def _walk(value: Any) -> Iterable[Any]:
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def _is_find_skills_node(node: dict[str, Any]) -> bool:
    name = _tool_name(node)
    if not name:
        return False
    normalized = _normalize_name(name)
    if "find_skills" not in normalized:
        return False
    server = _normalize_name(_server_name(node) or "")
    return (
        normalized == "find_skills"
        or normalized.endswith("_find_skills")
        or "nowledge" in normalized
        or server in {"nowledge_mem", "nowledgemem"}
    )


def _tool_name(node: dict[str, Any]) -> str:
    for key in ("tool", "tool_name", "toolName", "name"):
        value = node.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    function = node.get("function")
    if isinstance(function, dict):
        value = function.get("name")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _server_name(node: dict[str, Any]) -> str:
    for key in ("server", "server_name", "serverName", "mcp_server", "mcpServer"):
        value = node.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _normalize_name(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace("-", "_")
        .replace(".", "_")
        .replace(":", "_")
    )


def _call_id(node: dict[str, Any]) -> str:
    for key in _CALL_ID_KEYS:
        value = node.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _result_payload(node: dict[str, Any]) -> list[Any]:
    payloads = [node[key] for key in _RESULT_KEYS if key in node]
    return payloads or [node]


def _extract_skill_refs(value: Any) -> list[SkillOutcome]:
    parsed = _parse_json_text(value) if isinstance(value, str) else None
    if parsed is not None:
        return _extract_skill_refs(parsed)

    found: list[SkillOutcome] = []
    if isinstance(value, dict):
        skill_id = _skill_id(value)
        version = _skill_version(value)
        if skill_id and version:
            found.append((skill_id, version))
        for child in value.values():
            found.extend(_extract_skill_refs(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(_extract_skill_refs(child))
    return found


def _parse_json_text(value: str) -> Any | None:
    text = value.strip()
    if not text or text[0] not in "[{":
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _skill_id(node: dict[str, Any]) -> str:
    for key in ("skill_id", "skillId"):
        value = node.get(key)
        if isinstance(value, str) and value.strip() and _looks_like_skill_id(value):
            return value.strip()
    value = node.get("id")
    if (
        isinstance(value, str)
        and value.strip()
        and _looks_like_skill_id(value)
        and _looks_like_skill_record(node)
    ):
        return value.strip()
    return ""


def _looks_like_skill_id(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized.startswith("skill_") or normalized.startswith("skill-")


def _skill_version(node: dict[str, Any]) -> str:
    for key in ("version", "skill_version", "skillVersion"):
        value = node.get(key)
        if isinstance(value, (str, int, float)) and str(value).strip():
            return str(value).strip()
    metadata = node.get("metadata")
    if isinstance(metadata, dict):
        value = metadata.get("version")
        if isinstance(value, (str, int, float)) and str(value).strip():
            return str(value).strip()
    if _looks_like_skill_record(node):
        return "1"
    return ""


def _looks_like_skill_record(node: dict[str, Any]) -> bool:
    return any(
        key in node
        for key in (
            "name",
            "title",
            "description",
            "skill_name",
            "skillName",
            "score",
            "path",
        )
    )


def _dedupe(outcomes: Iterable[SkillOutcome]) -> list[SkillOutcome]:
    seen: set[SkillOutcome] = set()
    result: list[SkillOutcome] = []
    for skill_id, version in outcomes:
        key = (skill_id, version)
        if key in seen:
            continue
        seen.add(key)
        result.append(key)
    return result
