"""Windsurf Trajectory Extractor - Core extraction logic.

This module provides deep extraction of Cascade conversation history from
Windsurf's internal protobuf-encoded storage, including:
- Thinking content (internal reasoning, only in thinking mode)
- Visible responses (user-facing text)
- Tool calls with full parameters
- Microsecond-precision timestamps
- Provider information
"""

from __future__ import annotations

import base64
import json
import platform
import re
import sqlite3
import struct
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote

__all__ = [
    "find_windsurf_paths",
    "load_codeium_state",
    "workspace_name",
    "list_workspaces",
    "list_summaries",
    "extract_trajectory",
    "find_by_keywords",
]

# Default timezone for timestamp display (configurable)
DEFAULT_TZ = timezone(timedelta(hours=8))  # CST


def find_windsurf_paths() -> tuple[Path | None, Path | None]:
    """Find Windsurf state.vscdb and workspaceStorage paths.

    Supports both stable (Windsurf) and preview (Windsurf - Next) versions
    on macOS, Linux, and Windows.

    Returns:
        Tuple of (state_db_path, workspace_storage_path), either may be None.
    """
    system = platform.system()
    home = Path.home()

    # Define base directories per platform
    if system == "Darwin":  # macOS
        base = home / "Library/Application Support"
    elif system == "Linux":
        base = home / ".config"
    elif system == "Windows":
        import os

        base = Path(os.environ.get("APPDATA", home / "AppData/Roaming"))
    else:
        base = home / ".config"

    # Try both Windsurf variants (Next first as it's more common for dev users)
    variants = ["Windsurf - Next", "Windsurf"]

    for variant in variants:
        state_db = base / variant / "User/globalStorage/state.vscdb"
        ws_storage = base / variant / "User/workspaceStorage"
        if state_db.exists():
            return state_db, ws_storage

    return None, None


def load_codeium_state(state_db: Path) -> dict[str, Any]:
    """Load codeium.windsurf data from state.vscdb.

    Args:
        state_db: Path to state.vscdb file.

    Returns:
        Parsed JSON data from codeium.windsurf key.

    Raises:
        FileNotFoundError: If state.vscdb doesn't exist.
        KeyError: If codeium.windsurf key not found.
    """
    if not state_db.exists():
        raise FileNotFoundError(f"state.vscdb not found: {state_db}")

    conn = sqlite3.connect(str(state_db))
    try:
        row = conn.execute(
            "SELECT value FROM ItemTable WHERE key = 'codeium.windsurf'"
        ).fetchone()
        if not row:
            raise KeyError("codeium.windsurf key not found in state.vscdb")
        return json.loads(row[0])
    finally:
        conn.close()


def workspace_name(ws_storage: Path | None, ws_id: str) -> str:
    """Map workspace ID to human-readable project path.

    Args:
        ws_storage: Path to workspaceStorage directory.
        ws_id: Workspace ID (hash).

    Returns:
        Project path or "?" if not found.
    """
    if ws_storage is None:
        return "?"

    ws_file = ws_storage / ws_id / "workspace.json"
    if ws_file.exists():
        try:
            ws_data = json.loads(ws_file.read_text())
            folder = ws_data.get("folder", ws_data.get("workspace", "?"))
            # Parse file:// URI properly for cross-platform support
            decoded = unquote(folder)
            if decoded.startswith("file:///"):
                # Remove file:/// prefix
                path_part = decoded[8:]
                # On Windows, file:///C:/... -> C:/...
                # On Unix, file:///home/... -> /home/...
                if len(path_part) > 1 and path_part[1] == ":":
                    # Windows path (e.g., C:/Users/...)
                    return path_part
                else:
                    # Unix path - add leading slash back
                    return "/" + path_part
            return decoded
        except (json.JSONDecodeError, OSError):
            pass
    return "?"


# ── Protobuf Decoding ──────────────────────────────────────────────


def _decode_varint(data: bytes, pos: int) -> tuple[int, int]:
    """Decode a protobuf varint."""
    result = 0
    shift = 0
    while pos < len(data):
        b = data[pos]
        result |= (b & 0x7F) << shift
        pos += 1
        if not (b & 0x80):
            return result, pos
        shift += 7
    return result, pos


def _parse_fields(data: bytes, start: int, end: int) -> list[dict[str, Any]]:
    """Parse protobuf fields from a byte range."""
    fields: list[dict[str, Any]] = []
    p = start
    while p < end:
        try:
            tag, np = _decode_varint(data, p)
            if tag == 0:
                p = np
                continue
            fn, wt = tag >> 3, tag & 7
            if wt == 0:  # Varint
                val, np = _decode_varint(data, np)
                fields.append({"fn": fn, "type": "varint", "value": val, "pos": p})
                p = np
            elif wt == 2:  # Length-delimited
                sz, np = _decode_varint(data, np)
                if sz > end - np or sz < 0:
                    break
                fields.append(
                    {"fn": fn, "type": "bytes", "start": np, "end": np + sz, "pos": p}
                )
                p = np + sz
            elif wt == 1:  # Fixed64
                fields.append(
                    {
                        "fn": fn,
                        "type": "fixed64",
                        "value": struct.unpack_from("<Q", data, np)[0],
                        "pos": p,
                    }
                )
                p = np + 8
            elif wt == 5:  # Fixed32
                fields.append(
                    {
                        "fn": fn,
                        "type": "fixed32",
                        "value": struct.unpack_from("<I", data, np)[0],
                        "pos": p,
                    }
                )
                p = np + 4
            else:
                break
        except Exception:
            break
    return fields


def _parse_timestamp(
    data: bytes, start: int, end: int, tz: timezone = DEFAULT_TZ
) -> datetime | None:
    """Parse protobuf Timestamp message {f1=seconds, f2=nanos}."""
    fields = _parse_fields(data, start, end)
    seconds = nanos = 0
    for f in fields:
        if f["fn"] == 1 and f["type"] == "varint":
            seconds = f["value"]
        elif f["fn"] == 2 and f["type"] == "varint":
            nanos = f["value"]
    # Sanity check: timestamp should be reasonable (2020-2040)
    # Using wider range to avoid "time bomb" issues
    if 1577836800 < seconds < 2208988800:
        return datetime.fromtimestamp(seconds + nanos / 1e9, tz=tz)
    return None


def _try_decode_str(data: bytes, start: int, end: int) -> str | None:
    """Try to decode bytes as UTF-8 string."""
    try:
        return data[start:end].decode("utf-8")
    except Exception:
        return None


# ── Public API ────────────────────────────────────────────────────


def list_workspaces(
    state: dict[str, Any], ws_storage: Path | None
) -> list[dict[str, Any]]:
    """List all workspaces with trajectory data.

    Args:
        state: Codeium state data.
        ws_storage: Path to workspaceStorage directory.

    Returns:
        List of workspace info dicts with id, size, and path.
    """
    workspaces = []
    for k, v in state.items():
        if "cachedActiveTrajectory" in k:
            ws_id = k.split(":")[-1]
            workspaces.append(
                {
                    "id": ws_id,
                    "size": len(str(v)),
                    "path": workspace_name(ws_storage, ws_id),
                }
            )
    return sorted(workspaces, key=lambda x: -x["size"])


def list_summaries(state: dict[str, Any], ws_id: str) -> list[dict[str, str]]:
    """List conversation summaries for a workspace.

    Args:
        state: Codeium state data.
        ws_id: Workspace ID.

    Returns:
        List of summary dicts with uuid and title.

    Raises:
        KeyError: If workspace summaries not found.
    """
    key = f"windsurf.state.cachedTrajectorySummaries:{ws_id}"
    if key not in state:
        raise KeyError(f"Summaries not found for workspace: {ws_id}")

    blob = base64.b64decode(state[key])
    top = _parse_fields(blob, 0, len(blob))

    summaries = []
    for f in top:
        if f["type"] != "bytes":
            continue
        entry = _parse_fields(blob, f["start"], f["end"])
        uuid = ""
        title = ""
        for ef in entry:
            if ef["fn"] == 1 and ef["type"] == "bytes":
                uuid = _try_decode_str(blob, ef["start"], ef["end"]) or ""
            elif ef["fn"] == 2 and ef["type"] == "bytes":
                inner = _parse_fields(blob, ef["start"], ef["end"])
                for inf in inner:
                    if inf["type"] == "bytes" and not title:
                        t = _try_decode_str(blob, inf["start"], inf["end"])
                        if t and len(t) > 5 and not t.startswith("\n"):
                            title = t[:80]
        summaries.append({"uuid": uuid, "title": title})
    return summaries


def extract_trajectory(
    state: dict[str, Any], ws_id: str, tz: timezone = DEFAULT_TZ
) -> dict[str, Any]:
    """Extract complete trajectory data for a workspace.

    Args:
        state: Codeium state data.
        ws_id: Workspace ID.
        tz: Timezone for timestamp display.

    Returns:
        Dict with trajectory_uuid, size_bytes, steps list, and statistics.

    Raises:
        KeyError: If trajectory not found.
    """
    key = f"windsurf.state.cachedActiveTrajectory:{ws_id}"
    if key not in state:
        raise KeyError(f"Trajectory not found for workspace: {ws_id}")

    blob = base64.b64decode(state[key])

    # Parse top-level: f1=UUID, f2=steps container
    top = _parse_fields(blob, 0, len(blob))
    traj_uuid = ""
    inner_start = inner_end = 0

    for f in top:
        if f["fn"] == 1 and f["type"] == "bytes":
            traj_uuid = _try_decode_str(blob, f["start"], f["end"]) or ""
        elif f["fn"] == 2 and f["type"] == "bytes":
            inner_start, inner_end = f["start"], f["end"]

    # Parse steps
    steps_raw = _parse_fields(blob, inner_start, inner_end)
    steps = []

    for step_f in steps_raw:
        if step_f["type"] != "bytes":
            continue

        step = _parse_fields(blob, step_f["start"], step_f["end"])
        step_id = None
        step_type = None
        timestamp = None
        thinking = None
        visible = None
        tool_calls: list[dict[str, Any]] = []
        provider = None
        content_texts: list[str] = []

        for sf in step:
            if sf["fn"] == 1 and sf["type"] == "varint":
                step_id = sf["value"]
            elif sf["fn"] == 4 and sf["type"] == "varint":
                step_type = sf["value"]
            elif sf["fn"] == 5 and sf["type"] == "bytes":
                meta = _parse_fields(blob, sf["start"], sf["end"])
                for mf in meta:
                    if mf["fn"] == 1 and mf["type"] == "bytes":
                        timestamp = _parse_timestamp(blob, mf["start"], mf["end"], tz)
            elif sf["fn"] == 20 and sf["type"] == "bytes":
                # AI response: f3=thinking, f7=tool_call, f8=visible, f12=provider
                ai_fields = _parse_fields(blob, sf["start"], sf["end"])
                for af in ai_fields:
                    if af["fn"] == 3 and af["type"] == "bytes":
                        thinking = _try_decode_str(blob, af["start"], af["end"])
                    elif af["fn"] == 7 and af["type"] == "bytes":
                        tc_fields = _parse_fields(blob, af["start"], af["end"])
                        tc: dict[str, Any] = {}
                        for tf in tc_fields:
                            if tf["type"] == "bytes":
                                t = _try_decode_str(blob, tf["start"], tf["end"])
                                if t:
                                    if tf["fn"] == 1:
                                        tc["tool_id"] = t
                                    elif tf["fn"] == 2:
                                        tc["tool_name"] = t
                                    elif tf["fn"] == 3:
                                        try:
                                            tc["params"] = json.loads(t)
                                        except Exception:
                                            tc["params_raw"] = t[:500]
                        if tc:
                            tool_calls.append(tc)
                    elif af["fn"] == 8 and af["type"] == "bytes":
                        visible = _try_decode_str(blob, af["start"], af["end"])
                    elif af["fn"] == 12 and af["type"] == "bytes":
                        provider = _try_decode_str(blob, af["start"], af["end"])
            elif sf["fn"] in (19, 28) and sf["type"] == "bytes":
                content = _parse_fields(blob, sf["start"], sf["end"])
                for cf in content:
                    if cf["type"] == "bytes":
                        t = _try_decode_str(blob, cf["start"], cf["end"])
                        if t and len(t) > 5:
                            content_texts.append(t[:500])

        entry: dict[str, Any] = {
            "step_id": step_id,
            "step_type": step_type,
            "timestamp": timestamp.isoformat() if timestamp else None,
            "timestamp_unix_ms": int(timestamp.timestamp() * 1000)
            if timestamp
            else None,
            "content_preview": (visible or (content_texts[0] if content_texts else ""))[
                :200
            ],
        }
        if thinking:
            entry["thinking"] = thinking
        if visible:
            entry["visible"] = visible
        if tool_calls:
            entry["tool_calls"] = tool_calls
        if provider:
            entry["provider"] = provider
        steps.append(entry)

    # Statistics
    ts_list = [s["timestamp_unix_ms"] for s in steps if s["timestamp_unix_ms"]]
    stats = {
        "total_steps": len(steps),
        "steps_with_timestamp": len(ts_list),
        "steps_with_thinking": sum(1 for s in steps if s.get("thinking")),
        "steps_with_visible": sum(1 for s in steps if s.get("visible")),
        "steps_with_tool_calls": sum(1 for s in steps if s.get("tool_calls")),
    }
    if ts_list:
        stats["time_range"] = {
            "first": datetime.fromtimestamp(min(ts_list) / 1000, tz=tz).isoformat(),
            "last": datetime.fromtimestamp(max(ts_list) / 1000, tz=tz).isoformat(),
        }

    return {
        "trajectory_uuid": traj_uuid,
        "size_bytes": len(blob),
        "steps": steps,
        "statistics": stats,
    }


def find_by_keywords(
    state: dict[str, Any], keywords: list[str], ws_storage: Path | None
) -> list[dict[str, Any]]:
    """Search all trajectories for keywords.

    Args:
        state: Codeium state data.
        keywords: List of keywords to search.
        ws_storage: Path to workspaceStorage directory.

    Returns:
        List of matching workspace info with hit counts.
    """
    results = []
    for k, v in sorted(state.items()):
        if "cachedActiveTrajectory" not in k:
            continue
        ws_id = k.split(":")[-1]
        try:
            blob = base64.b64decode(v)
            text = blob.decode("ascii", errors="ignore")
            hits = {kw: text.count(kw) for kw in keywords if text.count(kw) > 0}
            if hits:
                # Try to find model info
                models = re.findall(r"--model\s+(\w+)", text)
                result = {
                    "id": ws_id,
                    "path": workspace_name(ws_storage, ws_id),
                    "size_bytes": len(blob),
                    "hits": hits,
                }
                if models:
                    result["models"] = dict(Counter(models))
                results.append(result)
        except Exception:
            pass
    return results
