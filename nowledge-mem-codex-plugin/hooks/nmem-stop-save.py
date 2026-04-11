#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


HOME = Path.home()
CODEX_DIR = HOME / ".codex"
LOG_FILE = CODEX_DIR / "log" / "nowledge-mem-stop-hook.log"
STATE_FILE = CODEX_DIR / "nowledge_mem_codex_hook_state.json"
IMPORT_TIMEOUT_SECONDS = 30


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def log(message: str) -> None:
    ensure_parent(LOG_FILE)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_json(path: Path, payload: dict) -> None:
    ensure_parent(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def configure_nmem_env() -> None:
    config_path = HOME / ".nowledge-mem" / "config.json"
    config = load_json(config_path)
    api_url = config.get("apiUrl") or config.get("api_url")
    api_key = config.get("apiKey") or config.get("api_key")
    if api_url and "NMEM_API_URL" not in os.environ:
        os.environ["NMEM_API_URL"] = str(api_url)
    if api_key and "NMEM_API_KEY" not in os.environ:
        os.environ["NMEM_API_KEY"] = str(api_key)


def resolve_nmem_command() -> list[str] | None:
    nmem_bin = shutil.which("nmem") or shutil.which("nmem.cmd")
    if nmem_bin:
        return [nmem_bin]

    uvx_bin = shutil.which("uvx") or shutil.which("uvx.cmd")
    if uvx_bin:
        return [uvx_bin, "--from", "nmem-cli", "nmem"]

    return None


def shorten_title(text: str, limit: int = 60) -> str:
    normalized = text.replace("\n", " ").strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[:limit].rstrip() + "..."


def is_agents_preamble(text: str) -> bool:
    stripped = text.strip()
    return (
        stripped.startswith("# AGENTS.md instructions for ")
        or (
            stripped.startswith("# AGENTS.md")
            and (
                "<INSTRUCTIONS>" in stripped
                or "\n## Purpose" in stripped
                or "\n## nmem" in stripped
            )
        )
    )


def is_environment_context(text: str) -> bool:
    stripped = text.strip()
    return stripped.startswith("<environment_context>") and stripped.endswith("</environment_context>")


def extract_files_request(text: str) -> str | None:
    marker = "## My request for Codex"
    if marker not in text:
        return None
    tail = text.split(marker, 1)[1]
    tail = re.sub(r"^[:：\s]+", "", tail)
    return tail.strip() or None


def summarize_user_message(text: str) -> str:
    normalized = text.replace("\n", " ").strip()
    normalized = re.sub(
        r"^codex://threads/[0-9a-fA-F-]+[\s,，:：-]*",
        "",
        normalized,
    )
    normalized = re.sub(
        r"^(请帮我|请你|请|麻烦你|麻烦|帮我看看|你看看|帮我看下|帮我看一下|帮我|看下|看一下)\s*",
        "",
        normalized,
    )
    normalized = re.sub(
        r"^(can you|could you|please|help me|take a look at|look into)\s+",
        "",
        normalized,
        flags=re.IGNORECASE,
    )
    normalized = normalized.replace("是不是", "是否").replace("能不能", "是否能")
    normalized = normalized.strip(" \t\r\n?？!！。")
    normalized = re.sub(r"\s+", " ", normalized)
    return shorten_title(normalized or text)


def derive_thread_title(parsed: dict, cwd: str) -> str:
    for message in parsed.get("messages", []):
        if message.get("role") != "user":
            continue
        content = (message.get("content") or "").strip()
        if not content or is_agents_preamble(content) or is_environment_context(content):
            continue
        files_request = extract_files_request(content)
        if files_request:
            return summarize_user_message(files_request)
        return summarize_user_message(content)

    workspace = cwd or parsed.get("workspace") or ""
    if workspace:
        return f"Codex: {Path(workspace).name}"

    parsed_title = (parsed.get("title") or "").strip()
    if parsed_title and not is_agents_preamble(parsed_title):
        return shorten_title(parsed_title)

    return "Codex Session"


def import_current_transcript(payload: dict) -> tuple[int, str]:
    session_id = payload.get("session_id") or ""
    raw_transcript_path = payload.get("transcript_path") or ""
    cwd = payload.get("cwd") or ""
    hook_event_name = payload.get("hook_event_name") or "unknown"

    log(f"start event={hook_event_name} session={session_id or 'missing'} cwd={cwd or 'missing'}")
    if not session_id:
        return 0, "skip: missing session_id"
    if not raw_transcript_path:
        return 0, f"skip: transcript_path missing or unreadable for session={session_id}"

    transcript_path = Path(raw_transcript_path)
    if not (transcript_path.exists() and transcript_path.is_file()):
        return 0, f"skip: transcript_path missing or unreadable for session={session_id}"
    log(f"transcript={transcript_path}")

    nmem_command = resolve_nmem_command()
    if not nmem_command:
        return 0, "skip: neither nmem nor uvx was found in PATH"

    try:
        from nmem_cli.session_import import parse_codex_session_streaming
    except Exception as exc:
        return 0, f"skip: failed to import nmem_cli parser: {exc}"

    try:
        parsed = parse_codex_session_streaming(transcript_path, truncate_large_content=True)
    except Exception as exc:
        return 0, f"skip: failed to parse codex rollout: {exc}"

    messages = [
        {"role": message.get("role"), "content": message.get("content", "")}
        for message in parsed.get("messages", [])
    ]
    if not messages:
        return 0, f"skip: parsed zero messages for session={session_id}"

    thread_id = parsed.get("thread_id") or f"codex-{session_id}"
    message_count = len(messages)
    content_hash = hashlib.sha256(
        json.dumps(messages, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()

    state = load_json(STATE_FILE)
    previous = state.get(session_id, {})
    if (
        previous.get("content_hash") == content_hash
        and previous.get("message_count") == message_count
    ):
        return 0, f"skip: unchanged transcript for session={session_id}"

    import_messages = messages
    previous_count = previous.get("message_count")
    if (
        isinstance(previous_count, int)
        and previous_count > 0
        and previous_count < message_count
        and previous.get("thread_id") == thread_id
        and previous.get("source_file") == str(transcript_path)
    ):
        import_messages = messages[previous_count:]

    if not import_messages:
        return 0, f"skip: no new messages for session={session_id}"

    import_payload = {
        "title": derive_thread_title(parsed, cwd),
        "messages": import_messages,
    }

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as handle:
        json.dump(import_payload, handle, ensure_ascii=False)
        temp_path = Path(handle.name)

    try:
        command = [*nmem_command, "--json", "t", "import", "-f", str(temp_path), "--id", thread_id, "-s", "codex"]
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=os.environ.copy(),
            timeout=IMPORT_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return 0, f"skip: nmem import timed out after {IMPORT_TIMEOUT_SECONDS}s for thread={thread_id}"
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass

    output = (result.stdout or "") + (result.stderr or "")
    if result.returncode == 0:
        state[session_id] = {
            "content_hash": content_hash,
            "message_count": message_count,
            "thread_id": thread_id,
            "source_file": str(transcript_path),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        save_json(STATE_FILE, state)

    return result.returncode, output.strip()


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        log("skip: empty hook payload")
        return 0

    try:
        payload = json.loads(raw)
    except Exception as exc:
        log(f"skip: invalid hook payload: {exc}")
        return 0

    configure_nmem_env()
    status, output = import_current_transcript(payload)
    log(f"nmem_exit={status}")
    if output:
        for line in output.splitlines():
            log(line)
    log("")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
