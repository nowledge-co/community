#!/usr/bin/env python3
"""Proma session capture for Nowledge Mem lifecycle hooks.

Proma stores Claude Agent SDK transcripts under:

    ~/.proma/sdk-config/projects/<workspace-hash>/<session-id>.jsonl

Older builds used ~/.proma/agent-sessions/<session-id>.jsonl. This hook
supports both, converts Proma JSONL into nmem thread messages, and uploads
them through the nmem REST API as source="proma".
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any


def _load_nmem_config() -> dict[str, str]:
    config_path = Path.home() / ".nowledge-mem" / "config.json"
    if config_path.exists():
        try:
            with config_path.open("r", encoding="utf-8") as fh:
                loaded = json.load(fh)
            return loaded if isinstance(loaded, dict) else {}
        except Exception:
            pass
    return {}


_NMEM_CFG = _load_nmem_config()


def _config_value(*keys: str) -> str:
    for key in keys:
        value = _NMEM_CFG.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


API_BASE = (
    os.environ.get("NMEM_API_URL")
    or _config_value("apiUrl", "api_url")
    or "http://127.0.0.1:14242"
).rstrip("/")
API_KEY = os.environ.get("NMEM_API_KEY") or _config_value("apiKey", "api_key") or ""
REQUEST_TIMEOUT = 15
SAVE_RETRY_DELAYS = (0.0, 0.5, 1.5, 3.0)

PROMA_HOME = Path(os.environ.get("PROMA_HOME", Path.home() / ".proma")).expanduser()
PROMA_SDK_CONFIG_DIR = Path(
    os.environ.get("PROMA_SDK_CONFIG_DIR", PROMA_HOME / "sdk-config" / ".claude")
).expanduser()
SDK_PROJECTS_DIR = PROMA_SDK_CONFIG_DIR / "projects"
LEGACY_SESSIONS_DIR = PROMA_HOME / "agent-sessions"
LOG_DIR = PROMA_HOME / "logs"
LOG_FILE = LOG_DIR / "nm-hooks.log"

HEADERS = {
    "Content-Type": "application/json",
    "APP": "Proma",
}
if API_KEY:
    HEADERS["Authorization"] = f"Bearer {API_KEY}"
    HEADERS["X-NMEM-API-Key"] = API_KEY


def log(msg: str) -> None:
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(f"[{ts}] save-to-nmem {msg}\n")
    except Exception:
        pass


def read_hook_input() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        loaded = json.loads(raw)
        return loaded if isinstance(loaded, dict) else {}
    except json.JSONDecodeError:
        return {}


def payload_value(payload: dict[str, Any], *keys: str) -> str | None:
    containers: list[dict[str, Any]] = [payload]
    for outer_key in ("input", "data", "payload", "hookInput"):
        nested = payload.get(outer_key)
        if isinstance(nested, dict):
            containers.append(nested)
            nested_input = nested.get("input")
            if isinstance(nested_input, dict):
                containers.append(nested_input)
    for container in containers:
        for key in keys:
            value = container.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def api_request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any] | None:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as exc:
        body_text = ""
        try:
            body_text = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        log(f"API {method} {path} -> HTTP {exc.code}: {body_text[:500]}")
        return None
    except Exception as exc:
        log(f"API {method} {path} -> error: {exc}")
        return None


def api_path_quote(value: str) -> str:
    return urllib.parse.quote(value, safe="")


def _session_roots() -> list[Path]:
    roots = [SDK_PROJECTS_DIR, LEGACY_SESSIONS_DIR]
    return [root for root in roots if root.exists()]


def _iter_session_files() -> list[Path]:
    files: list[Path] = []
    for root in _session_roots():
        try:
            if root == SDK_PROJECTS_DIR:
                files.extend(root.rglob("*.jsonl"))
            else:
                files.extend(root.glob("*.jsonl"))
        except Exception as exc:
            log(f"scan failed root={root}: {exc}")
    return files


def find_session_file(session_id: str | None = None) -> Path | None:
    files = _iter_session_files()
    if not files:
        return None

    if session_id:
        for path in files:
            if path.stem == session_id:
                return path

    try:
        return max(files, key=lambda p: p.stat().st_mtime)
    except Exception:
        return files[0] if files else None


def extract_text_from_content(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, dict):
        content_type = content.get("type", "")
        if content_type == "text":
            text = content.get("text", "")
            return text.strip() if isinstance(text, str) else ""
        if content_type == "tool_use":
            name = content.get("name", "unknown")
            return f"[tool: {name}]"
        if content_type == "tool_result":
            result = content.get("content", "")
            if isinstance(result, str) and result:
                return f"[result: {result[:2000]}]"
            if isinstance(result, list):
                return "[result: ...]"
        return ""

    if not isinstance(content, list):
        return ""

    parts: list[str] = []
    for block in content:
        text = extract_text_from_content(block)
        if text:
            parts.append(text)
    return "\n".join(parts)


def parse_session_messages(session_path: Path) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    seen_uuids: set[str] = set()

    with session_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg_type = entry.get("type", "")
            message = entry.get("message", {})
            if not isinstance(message, dict):
                continue

            uuid = entry.get("uuid", "")
            if uuid and uuid in seen_uuids:
                continue
            if uuid:
                seen_uuids.add(uuid)

            timestamp = entry.get("timestamp")
            content = message.get("content", [])

            if msg_type == "user":
                role = "user"
            elif msg_type == "assistant":
                role = message.get("role", "assistant")
                if role == "user":
                    continue
                role = "assistant"
            else:
                continue

            text = extract_text_from_content(content)
            if not text:
                continue

            message_body: dict[str, Any] = {"role": role, "content": text}
            metadata: dict[str, Any] = {}
            if uuid:
                metadata["external_id"] = f"proma:{uuid}"
            if isinstance(timestamp, str) and timestamp:
                metadata["timestamp"] = timestamp
            if metadata:
                message_body["metadata"] = metadata
            messages.append(message_body)

    return messages


def upload_thread(session_id: str, messages: list[dict[str, Any]], cwd: str | None) -> bool:
    title = f"Proma session {session_id[:8]}"
    if cwd:
        try:
            title = f"Proma - {Path(cwd).name}"
        except Exception:
            pass

    thread_id = f"proma-{session_id}"
    thread_path_id = api_path_quote(thread_id)

    append_body: dict[str, Any] = {
        "messages": messages,
        "deduplicate": True,
        "idempotency_key": f"proma:{session_id}",
    }
    existing = api_request("GET", f"/threads/{thread_path_id}")
    if existing is not None:
        return api_request("POST", f"/threads/{thread_path_id}/append", append_body) is not None

    body: dict[str, Any] = {
        "source": "proma",
        "thread_id": thread_id,
        "title": title,
        "messages": messages,
    }
    if cwd:
        body["project"] = cwd

    return api_request("POST", "/threads", body) is not None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default="stop")
    args, _ = parser.parse_known_args()

    payload = read_hook_input()
    session_id = payload_value(payload, "session_id", "sessionId", "sessionID")
    cwd = payload_value(payload, "cwd", "projectDir", "workspace", "workspacePath")

    log(f"start event={args.event} session={session_id or 'latest'} cwd={cwd or 'missing'}")

    session_file = find_session_file(session_id)
    if not session_file:
        log(f"skip: session file not found for {session_id or 'latest'}")
        return 0

    resolved_session_id = session_id or session_file.stem
    log(f"parsing: {session_file}")
    messages = parse_session_messages(session_file)
    log(f"parsed {len(messages)} messages")

    if not messages:
        log("skip: no messages to upload")
        return 0

    for attempt, delay in enumerate(SAVE_RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        log(f"upload attempt {attempt + 1}/{len(SAVE_RETRY_DELAYS)}")
        if upload_thread(resolved_session_id, messages, cwd):
            log("upload ok")
            return 0
        log(f"upload attempt {attempt + 1} failed")

    log("upload failed after all retries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
