#!/usr/bin/env python3
"""Stop hook: imports a Dim Session into Nowledge Mem as a Thread.

Capture reads the Session through Dim's own daemon (`session export --format
json`) with the executable the daemon's CLI maintains, keeps only the operator
input and completed assistant replies, and imports the new messages with the
checkpointed-delta contract of `nmem t import`. It is fail-open and never
blocks a turn.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ElementTree
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Isolated Python omits the installed script directory from its import path.
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

import nmem_common

MAX_EXPORT_BYTES = 32 * 1024 * 1024
MAX_MESSAGE_CHARS = 200_000
MAX_TITLE_CHARS = 80
EXPORT_TIMEOUT_SECONDS = 20.0
IMPORT_TIMEOUT_SECONDS = 20.0
TOTAL_BUDGET_SECONDS = 50.0
LOCK_STALE_SECONDS = 300
MAX_RUNS = 3
PROMPT_MARKER = "<dim-hooks"
MEMBER_TAG = "dim-agent-message"


def user_texts(data: Dict[str, Any], role: str) -> List[str]:
    """Operator text, without any block Dim injected for a hook."""
    texts: List[str] = []
    user = data.get("user")
    if isinstance(user, dict):
        for block in user.get("content") or []:
            if not isinstance(block, dict):
                continue
            kind = block.get("type")
            if kind == "text":
                text = block.get("text")
                if isinstance(text, str) and text.strip() and not _is_injected(text):
                    texts.append(text)
            elif kind == "image":
                texts.append("[image attachment]")
        if texts or role != "member":
            return texts
    if role == "member":
        task = member_task(data)
        if task:
            texts.append(task)
    return texts


def _is_injected(text: str) -> bool:
    return text.lstrip().startswith(PROMPT_MARKER)


def member_task(data: Dict[str, Any]) -> str:
    """The unwrapped `<dim-agent-message>` block a Collaboration member got."""
    for block in data.get("blocks") or []:
        if not isinstance(block, dict):
            continue
        raw = block.get("text")
        if not isinstance(raw, str) or MEMBER_TAG not in raw:
            continue
        trimmed = raw.strip()
        if not trimmed.startswith("<" + MEMBER_TAG):
            continue
        try:
            root = ElementTree.fromstring(trimmed)
        except ElementTree.ParseError:
            return ""
        return "".join(root.itertext()).strip()
    return ""


def turn_end_index(events: List[Any]) -> int:
    """The index of the last `turn/end` event, or -1 when there is none."""
    last = -1
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            continue
        if event.get("type") == "turn" and event.get("name") == "end":
            last = index
    return last


def turn_outcomes(events: List[Any]) -> Dict[str, str]:
    """`turn_id` -> the exported turn outcome (`completed`, `failed`, ...)."""
    outcomes: Dict[str, str] = {}
    for event in events:
        if not isinstance(event, dict):
            continue
        if event.get("type") != "turn" or event.get("name") != "end":
            continue
        data = event.get("data")
        if not isinstance(data, dict):
            continue
        turn_id, status = data.get("turn_id"), data.get("status")
        if isinstance(turn_id, str) and isinstance(status, str):
            outcomes[turn_id] = status
    return outcomes


def unfinished_requests(events: List[Any]) -> set:
    """Request ids whose exported `model-output-end` did not complete."""
    requests = set()
    for event in events:
        if not isinstance(event, dict):
            continue
        if event.get("type") != "step" or event.get("name") != "model-output-end":
            continue
        data = event.get("data")
        if not isinstance(data, dict):
            continue
        request_id, status = data.get("request_id"), data.get("status")
        if isinstance(request_id, str) and status != "completed":
            requests.add(request_id)
    return requests


def build_messages(events: List[Any], role: str, session_id: str) -> List[Dict[str, Any]]:
    """Operator input and completed assistant replies, in order.

    Nothing after the last `turn/end` is read: a turn that is still running
    (its input and streaming text) belongs to a later Stop. Assistant text is
    kept only for turns whose exported outcome is `completed`, and only from
    model requests that completed; operator input is kept whatever the turn
    outcome was, because a failed or cancelled turn fires no Stop of its own.

    Excluded: every raw `blocks` input, thinking, every tool step and result,
    Mem's own injected prompt text, and any text from a model request that
    called a tool (that step is not a completed reply).
    """
    cut = turn_end_index(events)
    if cut < 0:
        return []
    events = events[: cut + 1]
    outcomes = turn_outcomes(events)
    unfinished = unfinished_requests(events)
    tool_requests = set()
    for event in events:
        if not isinstance(event, dict) or event.get("type") != "step":
            continue
        if event.get("name") not in ("tool-use", "tool-call"):
            continue
        data = event.get("data")
        request_id = data.get("request_id") if isinstance(data, dict) else None
        if isinstance(request_id, str):
            tool_requests.add(request_id)
    ordered: List[Dict[str, Any]] = []
    slots: Dict[Tuple[Any, Any], Dict[str, Any]] = {}
    for event in events:
        if not isinstance(event, dict):
            continue
        sequence = event.get("sequence")
        if not isinstance(sequence, int):
            continue
        data = event.get("data")
        data = data if isinstance(data, dict) else {}
        kind, name = event.get("type"), event.get("name")
        if kind == "input" and name == "message":
            texts = user_texts(data, role)
            if texts:
                ordered.append(
                    {
                        "role": "user",
                        "seq": sequence,
                        "at": event.get("create_at"),
                        "text": "\n".join(texts),
                    }
                )
        elif kind == "step" and name == "text":
            request_id, delta = data.get("request_id"), data.get("delta")
            if not isinstance(request_id, str) or not isinstance(delta, str) or not delta.strip():
                continue
            if outcomes.get(data.get("turn_id")) != "completed":
                continue
            if request_id in tool_requests or request_id in unfinished:
                continue
            key = (data.get("turn_id"), request_id)
            slot = slots.get(key)
            if slot is None:
                slot = {
                    "role": "assistant",
                    "seq": sequence,
                    "at": event.get("create_at"),
                    "parts": [],
                }
                slots[key] = slot
                ordered.append(slot)
            slot["parts"].append(delta)
    messages: List[Dict[str, Any]] = []
    for item in ordered:
        text = "".join(item["parts"]) if "parts" in item else item["text"]
        text = text.strip()
        if not text:
            continue
        if len(text) > MAX_MESSAGE_CHARS:
            text = text[:MAX_MESSAGE_CHARS] + "..."
        message: Dict[str, Any] = {
            "role": item["role"],
            "content": text,
            "metadata": {
                "external_id": "dim:%s:%d" % (session_id, item["seq"]),
            },
        }
        stamp = _timestamp(item.get("at"))
        if stamp:
            message["timestamp"] = stamp
        messages.append(message)
    return messages


def _timestamp(value: Any) -> str:
    if not isinstance(value, int) or value <= 0:
        return ""
    try:
        return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError):
        return ""


def derive_title(messages: List[Dict[str, Any]], session_id: str) -> str:
    for message in messages:
        if message.get("role") != "user":
            continue
        for line in message.get("content", "").splitlines():
            line = line.strip()
            if line:
                return line[:MAX_TITLE_CHARS]
    return "Dim " + session_id[:MAX_TITLE_CHARS]


def _fingerprint(messages: List[Dict[str, Any]]) -> str:
    canonical = json.dumps(messages, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _prefix_unchanged(messages: List[Dict[str, Any]], count: int, digest: str) -> bool:
    """Whether the Thread's first `count` messages still match what was sent."""
    if not digest or count < 0 or count > len(messages):
        return False
    return _fingerprint(messages[:count]) == digest


def acknowledgement(
    returned: bool, payload: Dict[str, Any], checkpointed: bool
) -> Tuple[str, Optional[int]]:
    """Reads `nmem t import`'s result the way the checkpoint contract defines it."""
    results = payload.get("results") if isinstance(payload, dict) else None
    results = results if isinstance(results, list) else []
    for result in results:
        if isinstance(result, dict) and result.get("error_code") in (
            "checkpoint_conflict",
            "thread_not_found",
        ):
            return "conflict", None
    if not returned or not isinstance(payload, dict):
        return "failed", None
    failed_count = payload.get("failed_count", 0)
    if payload.get("success") is not True or not isinstance(failed_count, int) or failed_count > 0:
        return "failed", None
    if not results or not isinstance(results[0], dict) or results[0].get("success") is not True:
        return "failed", None
    if checkpointed and results[0].get("append_mode") != "checkpointed":
        return "failed", None
    count = results[0].get("message_count")
    if not isinstance(count, int) or count < 0:
        return "failed", None
    return "acknowledged", count


def state_path(root: Path, key: str) -> Path:
    return root / (key + ".json")


def read_state(root: Path, key: str) -> Tuple[Optional[int], str, Optional[int]]:
    """(local position, digest at that position, Mem's acknowledged count).

    `position` is how many local messages Mem has acknowledged; `count` is the
    thread total Mem reported. They differ after a full import into a thread
    that already holds records for changed messages, so they are stored apart.
    A state written by an earlier package has no `position`; it is treated as
    no state, which means one full import.
    """
    raw = nmem_common.read_private(state_path(root, key), 8192)
    if not raw:
        return None, "", None
    try:
        state = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeError):
        return None, "", None
    if not isinstance(state, dict):
        return None, "", None
    position = state.get("position")
    digest = state.get("digest")
    count = state.get("count")
    valid = (
        isinstance(position, int)
        and not isinstance(position, bool)
        and position >= 0
        and isinstance(count, int)
        and not isinstance(count, bool)
        and count >= 0
        and isinstance(digest, str)
    )
    if not valid:
        return None, "", None
    return position, digest, count


def write_state(root: Path, key: str, position: int, digest: str, count: int) -> None:
    data = json.dumps(
        {"position": position, "digest": digest, "count": count}, sort_keys=True
    ).encode("utf-8")
    nmem_common.write_private(state_path(root, key), data)


def acquire_lock(root: Path, key: str) -> Optional[Path]:
    path = root / (key + ".lock")
    for attempt in (0, 1):
        try:
            descriptor = os.open(
                str(path),
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | nmem_common.NOFOLLOW,
                0o600,
            )
        except FileExistsError:
            if attempt:
                return None
            try:
                age = time.time() - path.stat().st_mtime
            except OSError:
                age = LOCK_STALE_SECONDS + 1
            if age <= LOCK_STALE_SECONDS:
                return None
            try:
                path.unlink()
            except OSError:
                return None
            continue
        except OSError:
            return None
        try:
            os.write(descriptor, json.dumps({"pid": os.getpid()}).encode("utf-8"))
        except OSError:
            pass
        finally:
            os.close(descriptor)
        return path
    return None


def pending_path(root: Path, key: str) -> Path:
    return root / (key + ".pending")


def mark_pending(root: Path, key: str) -> None:
    try:
        descriptor = os.open(
            str(pending_path(root, key)),
            os.O_WRONLY | os.O_CREAT | os.O_APPEND | nmem_common.NOFOLLOW,
            0o600,
        )
        os.close(descriptor)
    except OSError:
        pass


def clear_pending(root: Path, key: str) -> None:
    try:
        pending_path(root, key).unlink()
    except OSError:
        pass


def export_session(
    binary: str, home: str, session_id: str, timeout: float
) -> Tuple[Optional[List[Any]], str]:
    data, reason = nmem_common.run_capped(
        binary,
        ["--home", home, "session", "export", session_id, "--format", "json"],
        timeout,
        MAX_EXPORT_BYTES,
    )
    if data is None:
        return None, reason
    try:
        document = json.loads(data.decode("utf-8"))
    except (ValueError, UnicodeError):
        return None, "bad_json"
    events = document.get("events") if isinstance(document, dict) else None
    if not isinstance(events, list):
        return None, "bad_json"
    return events, ""


def _failure_code(status: str, response: Dict[str, Any]) -> str:
    """A short, content-free reason for a failed import acknowledgement."""
    results = response.get("results") if isinstance(response, dict) else None
    if isinstance(results, list):
        for result in results:
            if isinstance(result, dict):
                code = result.get("error_code")
                if isinstance(code, str) and re.fullmatch(r"[a-z0-9_]{1,40}", code):
                    return code
    return status if re.fullmatch(r"[a-z0-9_]{1,40}", status) else "ack"


def capture_once(
    binary: str,
    home: str,
    session_id: str,
    role: str,
    key: str,
    root: Path,
    deadline: float,
) -> str:
    timeout = min(EXPORT_TIMEOUT_SECONDS, deadline - time.monotonic())
    if timeout <= 0.5:
        return "timeout"
    events, reason = export_session(binary, home, session_id, timeout)
    if events is None:
        return "export_" + reason if reason else "export_failed"
    messages = build_messages(events, role, session_id)
    if not messages:
        return "empty"
    digest = _fingerprint(messages)
    position, previous, count = read_state(root, key)
    if position == len(messages) and previous == digest:
        return "unchanged"
    if position is not None and not _prefix_unchanged(messages, position, previous):
        # The imported messages are not a prefix of what the Session now
        # holds (a changed or shrinking prefix). Re-import in full instead of
        # appending to a Thread that no longer matches.
        position = None
    title = derive_title(messages, session_id)
    delta = messages[position:] if position is not None else messages
    if not delta:
        return "unchanged"
    nmem = nmem_common.find_nmem()
    if not nmem:
        return "cli_unavailable"
    timeout = min(5.0, deadline - time.monotonic())
    if timeout <= 0.5:
        return "timeout"
    selectors, agent_id, resolved = nmem_common.space_selectors(nmem, timeout)
    if not resolved:
        return "scope_unresolved"
    import_path = root / (key + ".import.json")
    payload = {
        "title": title,
        "messages": delta,
        "metadata": {
            "source_app": "dim",
            "dim_session_id": session_id,
            "dim_collaboration_role": role,
        },
    }
    try:
        if not nmem_common.write_private(
            import_path, json.dumps(payload, ensure_ascii=False).encode("utf-8")
        ):
            return "import_file_failed"
        base = [
            "--json",
            "t",
            "import",
            "--file",
            str(import_path),
            "--source",
            "dim",
            "--id",
            nmem_common.safe_thread_id(session_id),
            "--title",
            title,
        ] + selectors
        if agent_id:
            base += ["--agent-id", agent_id]
        checkpointed = position is not None
        args = list(base)
        if checkpointed:
            # `position` bounds the local delta; Mem's own total (`count`) is
            # what `--expected-message-count` compares against. After a full
            # import into a thread that already holds changed messages, Mem
            # keeps the old records and its total is larger than len(messages).
            args += [
                "--expected-message-count",
                str(count),
                "--idempotency-key",
                "dim:%s:%d-%d:%s" % (session_id, count, count + len(delta), _fingerprint(delta)),
            ]
        timeout = min(IMPORT_TIMEOUT_SECONDS, deadline - time.monotonic())
        if timeout <= 0.5:
            return "timeout"
        returned, response = nmem_common.run_json_any(nmem, args, timeout)
        status, message_count = acknowledgement(returned, response, checkpointed)
        if status == "conflict":
            if not checkpointed:
                return "conflict_without_checkpoint"
            payload["messages"] = messages
            if not nmem_common.write_private(
                import_path, json.dumps(payload, ensure_ascii=False).encode("utf-8")
            ):
                return "import_file_failed"
            timeout = min(IMPORT_TIMEOUT_SECONDS, deadline - time.monotonic())
            if timeout <= 0.5:
                return "timeout"
            returned, response = nmem_common.run_json_any(nmem, base, timeout)
            status, message_count = acknowledgement(returned, response, False)
        if status != "acknowledged" or message_count is None:
            return "failed:" + _failure_code(status, response)
        # Every local message has now been acknowledged, whether Mem kept them
        # all or already held some; Mem's total is recorded separately.
        write_state(root, key, len(messages), _fingerprint(messages), message_count)
        return "imported"
    finally:
        try:
            import_path.unlink()
        except OSError:
            pass


def main() -> int:
    event = nmem_common.read_event()
    if event.get("hook_event_name") not in (None, "Stop"):
        return 0
    session_id = nmem_common.event_text(event, "session_id")
    if not session_id:
        nmem_common.log({"hook": "capture", "status": "bad_event"})
        return 0
    home = os.environ.get("DIMCODE_HOME", "").strip()
    if not home or "\x00" in home or len(home) > 4096:
        nmem_common.log({"hook": "capture", "status": "skipped", "reason": "no_home"})
        return 0
    role = nmem_common.event_text(event, "collaboration_role", 32) or "leader"
    if role not in ("leader", "member"):
        role = "leader"
    binary = nmem_common.dim_binary(home)
    if not binary:
        nmem_common.log(
            {"hook": "capture", "status": "skipped", "reason": "executable_unavailable"}
        )
        return 0
    root = nmem_common.state_root()
    if root is None:
        # The temporary-directory root could not be trusted; write nothing,
        # not even a diagnostic line.
        return 0
    key = nmem_common.session_key(home, session_id)
    lock = acquire_lock(root, key)
    if lock is None:
        mark_pending(root, key)
        nmem_common.log({"hook": "capture", "status": "locked"})
        return 0
    started = time.monotonic()
    deadline = started + TOTAL_BUDGET_SECONDS
    status = "not_run"
    runs = 0
    try:
        while runs < MAX_RUNS:
            runs += 1
            clear_pending(root, key)
            status = capture_once(binary, home, session_id, role, key, root, deadline)
            if not pending_path(root, key).exists():
                break
    finally:
        try:
            lock.unlink()
        except OSError:
            pass
    nmem_common.log(
        {
            "hook": "capture",
            "status": status,
            "runs": runs,
            "ms": int((time.monotonic() - started) * 1000),
        }
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError):
        sys.exit(0)
