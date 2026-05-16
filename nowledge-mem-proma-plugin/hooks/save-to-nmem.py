#!/usr/bin/env python3
"""Proma session capture for Nowledge Mem Stop hooks.

Reads the current Proma session JSONL, converts messages to nmem thread
format, and uploads via the nmem REST API.

Configuration is read from the standard nmem config file
(~/.nowledge-mem/config.json) or NMEM_API_URL / NMEM_API_KEY env vars.

Modeled on the Codex hook at nowledge-mem-codex-plugin/hooks/nowledge-mem-stop-save.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Configuration — resolved from env vars, then nmem config, then defaults
# ---------------------------------------------------------------------------

def _load_nmem_config() -> dict[str, str]:
    config_path = Path.home() / ".nowledge-mem" / "config.json"
    if config_path.exists():
        try:
            with config_path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            pass
    return {}

_nmem_cfg = _load_nmem_config()

API_BASE = (
    os.environ.get("NMEM_API_URL")
    or _nmem_cfg.get("apiUrl")
    or "http://127.0.0.1:14242"
).rstrip("/")
API_KEY = (
    os.environ.get("NMEM_API_KEY")
    or _nmem_cfg.get("apiKey")
    or ""
)
REQUEST_TIMEOUT = 15
SAVE_RETRY_DELAYS = (0.0, 0.5, 1.5, 3.0)

PROMA_HOME = Path(os.environ.get("PROMA_HOME", Path.home() / ".proma"))
SESSIONS_DIR = PROMA_HOME / "agent-sessions"
LOG_DIR = PROMA_HOME / "log"
LOG_FILE = LOG_DIR / "nmem-hook.log"

HEADERS = {
    "Content-Type": "application/json",
    "APP": "Proma",
}
if API_KEY:
    HEADERS["Authorization"] = f"Bearer {API_KEY}"
    HEADERS["X-NMEM-API-Key"] = API_KEY

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(f"[{ts}] {msg}\n")
    except Exception:
        pass


def read_hook_input() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def payload_value(payload: dict[str, Any], *keys: str) -> str | None:
    containers: list[dict[str, Any]] = [payload]
    for outer_key in ("input", "data", "payload"):
        nested = payload.get(outer_key)
        if isinstance(nested, dict):
            containers.append(nested)
            ni = nested.get("input")
            if isinstance(ni, dict):
                containers.append(ni)
    for c in containers:
        for k in keys:
            v = c.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()
    return None


def api_request(method: str, path: str, body: dict | None = None) -> dict[str, Any] | None:
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


# ---------------------------------------------------------------------------
# Session parsing
# ---------------------------------------------------------------------------

def find_session_file(session_id: str) -> Path | None:
    path = SESSIONS_DIR / f"{session_id}.jsonl"
    if path.exists():
        return path
    try:
        candidates = sorted(
            SESSIONS_DIR.glob("*.jsonl"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        return candidates[0] if candidates else None
    except Exception:
        return None


def extract_text_from_content(content_blocks: list[dict]) -> str:
    parts: list[str] = []
    for block in content_blocks:
        t = block.get("type", "")
        if t == "text":
            text = block.get("text", "")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
        elif t == "tool_use":
            name = block.get("name", "unknown")
            parts.append(f"[tool: {name}]")
        elif t == "tool_result":
            content = block.get("content", "")
            if isinstance(content, str) and content:
                parts.append(f"[result: {content[:2000]}]")
            elif isinstance(content, list):
                parts.append("[result: ...]")
        elif t == "thinking":
            pass
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

            content = message.get("content", [])
            if not isinstance(content, list):
                content = []

            if msg_type == "user":
                text = extract_text_from_content(content)
                if text:
                    messages.append({"role": "user", "content": text})
            elif msg_type == "assistant":
                role = message.get("role", "assistant")
                if role == "user":
                    continue
                text = extract_text_from_content(content)
                if text:
                    messages.append({"role": "assistant", "content": text})

    return messages


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def upload_thread(session_id: str, messages: list[dict], cwd: str | None) -> bool:
    title = f"Proma session {session_id[:8]}"
    if cwd:
        try:
            p = Path(cwd)
            title = f"Proma - {p.name}"
        except Exception:
            pass

    body: dict[str, Any] = {
        "source": "proma",
        "thread_id": f"proma-{session_id}",
        "title": title,
        "messages": messages,
    }
    if cwd:
        body["project"] = cwd

    result = api_request("POST", "/threads", body)
    return result is not None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default="stop")
    args, _ = parser.parse_known_args()

    if not API_KEY:
        log("skip: no API key configured (set NMEM_API_KEY or ~/.nowledge-mem/config.json)")
        return 0

    payload = read_hook_input()
    session_id = payload_value(payload, "session_id", "sessionId")
    cwd = payload_value(payload, "cwd")

    log(f"start event={args.event} session={session_id or 'missing'} cwd={cwd or 'missing'}")

    if not session_id:
        try:
            candidates = sorted(
                SESSIONS_DIR.glob("*.jsonl"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if candidates:
                session_id = candidates[0].stem
                log(f"fallback session_id={session_id}")
        except Exception:
            pass

    if not session_id:
        log("skip: no session_id")
        return 0

    session_file = find_session_file(session_id)
    if not session_file:
        log(f"skip: session file not found for {session_id}")
        return 0

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
        if upload_thread(session_id, messages, cwd):
            log("upload ok")
            return 0
        log(f"upload attempt {attempt + 1} failed")

    log("upload failed after all retries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
