#!/usr/bin/env python3
"""Copilot CLI session capture for Nowledge Mem.

Reads Copilot CLI transcript events from stdin (via Stop hook), extracts
user/assistant messages, filters secrets, and creates threads via
``nmem t import``. Auto-distills valuable sessions.

Thread ID: ``copilot-{session_id}`` (stable per-session, enables incremental
append). State management with file locking for concurrent session safety.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

try:
    import fcntl
except ImportError:
    fcntl = None  # Windows — locking handled via msvcrt fallback


ROOT = Path.home() / ".copilot" / "nowledge-mem-hooks"
STATE_DIR = ROOT / "state"
LOG_FILE = ROOT / "hook-log.jsonl"

MIN_SAVE_CHARS = 24
MIN_DISTILL_CHARS = 320
MIN_DISTILL_ASSISTANT_CHARS = 220
DISTILL_COOLDOWN_SECS = 120

INCOMPLETE_RE = re.compile(
    r"(请确认|请选择|请告诉我|告诉我继续|完成后告诉我|需要你|你希望|你想让我|请提供|方便的话|要不要|"
    r"please confirm|let me know|which option|can you provide|what would you like|want me to)",
    re.IGNORECASE,
)
SIGNAL_RE = re.compile(
    r"(决定|采用|结论|原因|因为|流程|步骤|根因|修复|策略|标准|规则|约定|配置|经验|注意|陷阱|风险|"
    r"decision|because|rationale|procedure|workflow|root cause|playbook|guideline|trade-?off)",
    re.IGNORECASE,
)
TAG_BLOCK_RE = re.compile(
    r"<(current_datetime|reminder|tools_changed_notice)[^>]*>.*?</\1>", re.DOTALL
)
TAG_LINE_RE = re.compile(r"^\s*</?[^>\n]+>\s*$", re.MULTILINE)
SECRET_PATTERNS = [
    re.compile(r"(ghp_[A-Za-z0-9]{20,})"),
    re.compile(r"(github_pat_[A-Za-z0-9_]{20,})"),
    re.compile(r"(sk-[A-Za-z0-9_-]{16,})"),
    re.compile(r"(Bearer\s+)[A-Za-z0-9._-]{16,}", re.IGNORECASE),
    re.compile(
        r"((?:API|ACCESS|AUTH|SECRET|PASSWORD|TOKEN)[A-Z0-9_]*\s*[:=]\s*[\"']?)[^\"'\s]+",
        re.IGNORECASE,
    ),
]
SENSITIVE_SKIP_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"),
    re.compile(r"\bssh-(?:rsa|ed25519)\s+[A-Za-z0-9+/=]{80,}"),
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
    re.compile(
        r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9._-]{8,}\.[A-Za-z0-9._-]{8,}\b"
    ),
    re.compile(
        r"\b(?:postgres|postgresql|mysql|mongodb(?:\\+srv)?|redis|amqp|kafka)://\S+",
        re.IGNORECASE,
    ),
    re.compile(r"\b(?:cookie|set-cookie)\s*[:=]", re.IGNORECASE),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
]
SENSITIVE_ASSIGN_RE = re.compile(
    r"\b(?:api_key|access_key|access_token|auth_token|secret_key|secret|password|token|client_secret|"
    r"connection_string|database_url|session_cookie)\s*[:=]\s*[\"']?([A-Za-z0-9._~+/=-]{12,})",
    re.IGNORECASE,
)
PLACEHOLDER_HINTS = (
    "placeholder",
    "example",
    "sample",
    "dummy",
    "fake",
    "redacted",
    "test",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def log(payload: dict) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, ensure_ascii=False) + "\n")


def extract_input(payload: dict) -> dict:
    if isinstance(payload, dict):
        if isinstance(payload.get("input"), dict):
            return payload["input"]
        if isinstance(payload.get("data"), dict):
            data = payload["data"]
            if isinstance(data.get("input"), dict):
                return data["input"]
            return data
    return payload if isinstance(payload, dict) else {}


def strip_wrappers(text: str) -> str:
    text = text or ""
    text = TAG_BLOCK_RE.sub("", text)
    text = TAG_LINE_RE.sub("", text)
    return text.strip()


def redact(text: str) -> str:
    redacted = text or ""
    for pattern in SECRET_PATTERNS:
        if pattern.groups == 0:
            redacted = pattern.sub("[REDACTED]", redacted)
        elif pattern.groups == 1:
            redacted = pattern.sub("[REDACTED]", redacted)
        else:
            redacted = pattern.sub(r"\1[REDACTED]", redacted)
    return redacted


def clean_user_text(event: dict) -> str:
    data = event.get("data", {})
    text = (data.get("content") or "").strip()
    if not text:
        return ""
    return redact(strip_wrappers(text)).strip()


def clean_assistant_text(event: dict) -> str:
    data = event.get("data", {})
    return redact((data.get("content") or "").strip())


def raw_visible_text(events: list) -> str:
    parts: list[str] = []
    for event in events:
        data = event.get("data", {})
        if event.get("type") == "user.message":
            text = (data.get("content") or "").strip()
            if text:
                parts.append(text)
        elif event.get("type") == "assistant.message":
            text = (data.get("content") or "").strip()
            if text:
                parts.append(text)
    return "\n\n".join(parts)


def has_sensitive_content(text: str) -> bool:
    if any(pattern.search(text) for pattern in SENSITIVE_SKIP_PATTERNS):
        return True
    for match in SENSITIVE_ASSIGN_RE.finditer(text):
        value = match.group(1)
        lower_value = value.lower()
        if any(hint in lower_value for hint in PLACEHOLDER_HINTS):
            continue
        if len(value) >= 24:
            return True
        if len(value) >= 20 and (
            any(ch.isdigit() for ch in value)
            or any(ch in "._~+/=-" for ch in value)
        ):
            return True
    return False


def build_nmem_command(nmem_bin: str, *args: str) -> list[str]:
    if nmem_bin.lower().endswith(".cmd"):
        return [
            "cmd.exe",
            "/s",
            "/c",
            subprocess.list2cmdline([nmem_bin, *args]),
        ]
    return [nmem_bin, *args]


def load_events(transcript_path: str) -> list[dict]:
    with open(transcript_path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def find_index(events: list[dict], event_id: str | None) -> int | None:
    if not event_id:
        return None
    for idx, event in enumerate(events):
        if event.get("id") == event_id:
            return idx
    return None


def collect_messages(events: list[dict]) -> list[dict]:
    messages: list[dict] = []
    for event in events:
        etype = event.get("type")
        if etype == "user.message":
            text = clean_user_text(event)
            role = "user"
        elif etype == "assistant.message":
            text = clean_assistant_text(event)
            role = "assistant"
        else:
            continue

        if not text:
            continue
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"] += "\n\n" + text
        else:
            messages.append({"role": role, "content": text})
    return messages


def run_json(args: list[str]) -> dict:
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            proc.stderr.strip() or proc.stdout.strip() or "command failed"
        )
    output = proc.stdout.strip()
    return json.loads(output) if output else {}


def load_state(session_id: str) -> tuple[Path, dict]:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    path = STATE_DIR / f"{session_id}.json"
    if not path.exists():
        return path, {
            "active_start_event_id": None,
            "last_saved_turn_end_id": None,
            "last_distill_ts": 0,
            "last_content_hash": None,
        }
    with path.open(encoding="utf-8") as fh:
        state = json.load(fh)
        state.setdefault("last_distill_ts", 0)
        state.setdefault("last_content_hash", None)
        return path, state


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2)


def title_from_messages(messages: list[dict]) -> str:
    user_parts = [
        msg["content"].replace("\n", " ").strip()
        for msg in messages
        if msg["role"] == "user"
    ]
    title = user_parts[0] if user_parts else "GitHub Copilot CLI request"
    return title[:96]


def event_timestamp_ms(event: dict) -> int | None:
    raw = event.get("timestamp")
    if not raw:
        return None
    return int(
        datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp() * 1000
    )


def content_hash(messages: list[dict]) -> str:
    blob = json.dumps(messages, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    import shutil

    raw = sys.stdin.read().strip()
    payload = json.loads(raw) if raw else {}
    hook_input = extract_input(payload)

    session_id = hook_input.get("sessionId")
    transcript_path = hook_input.get("transcriptPath")
    stop_reason = hook_input.get("stopReason")
    hook_timestamp = hook_input.get("timestamp")

    if not session_id or not transcript_path or stop_reason != "end_turn":
        return 0
    if not Path(transcript_path).exists():
        return 0

    nmem_bin = shutil.which("nmem") or shutil.which("nmem.cmd")
    if not nmem_bin:
        log({"session_id": session_id, "action": "skip", "reason": "nmem_missing"})
        return 0

    lock_path = STATE_DIR / f"{session_id}.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("w", encoding="utf-8") as lock_fh:
        if fcntl:
            fcntl.flock(lock_fh, fcntl.LOCK_EX)
        else:
            import msvcrt
            msvcrt.locking(lock_fh.fileno(), msvcrt.LK_LOCK, 1)

        state_path, state = load_state(session_id)
        events = load_events(transcript_path)

        # --- Locate current turn end ---
        turn_end_events = [
            e for e in events if e.get("type") == "assistant.turn_end"
        ]
        if not turn_end_events:
            return 0
        current_turn_end = next(
            (
                event
                for event in reversed(turn_end_events)
                if hook_timestamp is None
                or (
                    event_timestamp_ms(event) is not None
                    and event_timestamp_ms(event) <= hook_timestamp
                )
            ),
            turn_end_events[-1],
        )
        current_turn_end_id = current_turn_end.get("id")
        if current_turn_end_id and current_turn_end_id == state.get(
            "last_saved_turn_end_id"
        ):
            return 0

        # --- Determine event window ---
        last_saved_idx = find_index(
            events, state.get("last_saved_turn_end_id")
        )
        real_user_indices = [
            idx
            for idx, event in enumerate(events)
            if event.get("type") == "user.message" and clean_user_text(event)
        ]
        if not real_user_indices:
            return 0

        if state.get("active_start_event_id"):
            start_idx = find_index(events, state["active_start_event_id"])
        else:
            start_idx = None
        if start_idx is None:
            start_idx = next(
                (
                    idx
                    for idx in real_user_indices
                    if last_saved_idx is None or idx > last_saved_idx
                ),
                None,
            )
        if start_idx is None:
            return 0

        end_idx = find_index(events, current_turn_end_id)
        if end_idx is None or end_idx <= start_idx:
            return 0

        slice_events = events[start_idx : end_idx + 1]

        # --- Incomplete turn detection ---
        turn_start_indices = [
            idx
            for idx, event in enumerate(slice_events)
            if event.get("type") == "assistant.turn_start"
        ]
        if not turn_start_indices:
            return 0
        cycle_start_idx = max(turn_start_indices)
        cycle_events = slice_events[cycle_start_idx:]

        cycle_tools: list[str] = []
        has_background = False
        used_task_complete = False
        tool_starts: dict[str, dict] = {}
        for event in cycle_events:
            if event.get("type") == "tool.execution_start":
                data = event.get("data", {})
                name = data.get("toolName")
                args = data.get("arguments", {})
                tool_starts[data.get("toolCallId")] = data
                cycle_tools.append(name)
                if name == "task_complete":
                    used_task_complete = True
                if name == "ask_user":
                    state["active_start_event_id"] = state.get(
                        "active_start_event_id"
                    ) or slice_events[0].get("id")
                    save_state(state_path, state)
                    log(
                        {
                            "session_id": session_id,
                            "action": "skip",
                            "reason": "awaiting_user",
                        }
                    )
                    return 0
                if name == "task" and args.get("mode") == "background":
                    has_background = True
                if name == "bash" and (
                    args.get("mode") == "async" or args.get("detach")
                ):
                    has_background = True
            elif event.get("type") == "tool.execution_complete":
                data = event.get("data", {})
                start = tool_starts.get(data.get("toolCallId"))
                if not start or start.get("toolName") != "bash":
                    continue
                result_blob = json.dumps(
                    data.get("result", {}), ensure_ascii=False
                )
                if "shellId" in result_blob:
                    has_background = True

        cycle_assistant_messages = [
            clean_assistant_text(event)
            for event in cycle_events
            if event.get("type") == "assistant.message"
            and clean_assistant_text(event)
        ]
        final_assistant_text = (
            cycle_assistant_messages[-1] if cycle_assistant_messages else ""
        )

        looks_incomplete = not used_task_complete and (
            not final_assistant_text
            or final_assistant_text.endswith(("?", "？"))
            or bool(INCOMPLETE_RE.search(final_assistant_text))
            or has_background
        )
        if looks_incomplete:
            state["active_start_event_id"] = state.get(
                "active_start_event_id"
            ) or slice_events[0].get("id")
            save_state(state_path, state)
            log(
                {
                    "session_id": session_id,
                    "action": "skip",
                    "reason": "unfinished_turn",
                }
            )
            return 0

        # --- Build and validate messages ---
        messages = collect_messages(slice_events)
        total_chars = sum(len(msg["content"]) for msg in messages)
        if len(messages) < 2 or total_chars < MIN_SAVE_CHARS:
            state["active_start_event_id"] = None
            state["last_saved_turn_end_id"] = current_turn_end_id
            save_state(state_path, state)
            log(
                {
                    "session_id": session_id,
                    "action": "skip",
                    "reason": "too_small",
                }
            )
            return 0

        if has_sensitive_content(raw_visible_text(slice_events)):
            state["active_start_event_id"] = None
            state["last_saved_turn_end_id"] = current_turn_end_id
            save_state(state_path, state)
            log(
                {
                    "session_id": session_id,
                    "action": "skip",
                    "reason": "sensitive_content",
                }
            )
            return 0

        # --- Stable per-session thread ID ---
        thread_id = f"copilot-{session_id}"
        title = title_from_messages(messages)

        import_file = None
        try:
            import_file = tempfile.NamedTemporaryFile(
                "w", encoding="utf-8", suffix=".json", delete=False
            )
            json.dump(messages, import_file, ensure_ascii=False)
            import_file.flush()
            import_file.close()

            thread_exists = False
            try:
                run_json(
                    build_nmem_command(
                        nmem_bin,
                        "--json",
                        "t",
                        "import",
                        "-f",
                        import_file.name,
                        "-t",
                        title,
                        "--id",
                        thread_id,
                        "-s",
                        "copilot-cli",
                    )
                )
            except Exception as exc:
                if "already exists" in str(exc).lower():
                    thread_exists = True
                else:
                    raise

            if thread_exists:
                run_json(
                    build_nmem_command(
                        nmem_bin,
                        "--json",
                        "t",
                        "append",
                        thread_id,
                        "-f",
                        import_file.name,
                    )
                )
        finally:
            if import_file and Path(import_file.name).exists():
                Path(import_file.name).unlink()

        # --- Auto-distill with guardrails ---
        current_hash = content_hash(messages)
        now_ts = int(time.time())
        assistant_text = "\n\n".join(
            msg["content"] for msg in messages if msg["role"] == "assistant"
        )
        combined_text = "\n\n".join(
            f"{msg['role']}: {msg['content']}" for msg in messages
        )
        should_try_distill = (
            total_chars >= MIN_DISTILL_CHARS
            and current_hash != state.get("last_content_hash")
            and (now_ts - state.get("last_distill_ts", 0)) >= DISTILL_COOLDOWN_SECS
            and (
                len(assistant_text) >= MIN_DISTILL_ASSISTANT_CHARS
                or len([msg for msg in messages if msg["role"] == "user"]) > 1
                or len(cycle_tools) >= 3
                or bool(SIGNAL_RE.search(combined_text))
            )
        )

        triage = None
        distill_attempted = False
        if should_try_distill:
            triage = run_json(
                build_nmem_command(
                    nmem_bin, "--json", "t", "triage", thread_id
                )
            )
            if triage.get("should_distill"):
                distill_attempted = True
                run_json(
                    build_nmem_command(
                        nmem_bin,
                        "--json",
                        "t",
                        "distill",
                        thread_id,
                        "--triage",
                    )
                )
                state["last_distill_ts"] = now_ts

        state["active_start_event_id"] = None
        state["last_saved_turn_end_id"] = current_turn_end_id
        state["last_content_hash"] = current_hash
        save_state(state_path, state)

        log(
            {
                "session_id": session_id,
                "action": "saved",
                "thread_id": thread_id,
                "message_count": len(messages),
                "total_chars": total_chars,
                "distill_attempted": distill_attempted,
                "triage": triage,
            }
        )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log({"action": "error", "error": str(exc)})
        raise
