#!/usr/bin/env python3
"""Bounded existing-profile maintenance for the Codex Stop hook."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from nmem_runtime import build_nmem_command as _build_nmem_command
from nmem_runtime import find_nmem_command as _find_nmem_command
from nmem_runtime import is_exact_space_id as _is_exact_space_id
from nmem_runtime import windows_no_window_kwargs as _windows_no_window_kwargs


NORMAL_STOP_RESPONSE = {"continue": True, "suppressOutput": True}
FEATURE_ENV = "NMEM_AGENT_PROFILE_MAINTENANCE"
COMMAND_TIMEOUT_SECONDS = 3.0
MAX_COMMAND_OUTPUT_BYTES = 64 * 1024
MAX_CLI_PATH_BYTES = 1024
MAX_DESCRIPTION_BYTES = 4096
MAX_LIST_ITEMS = 64
MAX_LIST_ITEM_BYTES = 512
MAX_SKILL_FIELD_BYTES = 256
TOKEN_RE = re.compile(r"[A-Za-z0-9_.:-]{1,120}")
MAINTENANCE_VERSION = 2
REVISION_RE = re.compile(r"m2:[0-9a-f]{64}:[0-9a-f]{64}")


def _enabled() -> bool:
    return os.environ.get(FEATURE_ENV, "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _bounded_text(value: Any, maximum: int, *, allow_empty: bool = True) -> str | None:
    if not isinstance(value, str):
        return None
    if not allow_empty and not value:
        return None
    try:
        size = len(value.encode("utf-8"))
    except UnicodeError:
        return None
    return value if size <= maximum else None


def _run_json(nmem: str, args: list[str]) -> dict[str, Any] | None:
    try:
        with tempfile.TemporaryFile() as output:
            proc = subprocess.run(
                _build_nmem_command(nmem, "--json", *args),
                stdout=output,
                stderr=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=COMMAND_TIMEOUT_SECONDS,
                check=False,
                **_windows_no_window_kwargs(),
            )
            # Mocked CompletedProcess values carry stdout directly. Real
            # processes write to the bounded-read temporary file so output is
            # never accumulated without a size check in plugin memory.
            if isinstance(proc.stdout, str):
                raw = proc.stdout
            else:
                output.seek(0, os.SEEK_END)
                if output.tell() > MAX_COMMAND_OUTPUT_BYTES:
                    return None
                output.seek(0)
                raw = output.read(MAX_COMMAND_OUTPUT_BYTES + 1).decode(
                    "utf-8", errors="replace"
                )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    if len(raw.encode("utf-8")) > MAX_COMMAND_OUTPUT_BYTES:
        return None
    try:
        payload = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _live_selection(nmem: str, context: str) -> tuple[str, str] | None:
    payload = _run_json(
        nmem,
        ["--agent-context", context, "mailbox", "status"],
    )
    return _selection_from_status(payload, context)


def _selection_from_status(payload: Any, context: str) -> tuple[str, str] | None:
    if not isinstance(payload, dict) or payload.get("name") != context:
        return None
    if (
        payload.get("state") != "usable"
        or payload.get("validation") != "live"
        or payload.get("configured") is not True
    ):
        return None
    selection = payload.get("selection")
    if not _typed_selection(selection):
        return None
    scope = selection.get("scope")
    address = selection.get("address")
    if not isinstance(scope, dict) or not isinstance(address, dict):
        return None
    agent_id = address.get("agent_id")
    space_id = scope.get("space_id")
    if not isinstance(agent_id, str) or TOKEN_RE.fullmatch(agent_id) is None:
        return None
    if not _is_exact_space_id(space_id):
        return None

    configured_agent = os.environ.get("NMEM_AGENT_ID", "").strip()
    configured_space = os.environ.get("NMEM_SPACE", "").strip()
    legacy_space = os.environ.get("NMEM_SPACE_ID")
    if (
        configured_agent and configured_agent != agent_id
        or configured_space and configured_space != space_id
        or legacy_space is not None and legacy_space != space_id
        or os.environ.get("NMEM_HOST_AGENT_ID", "").strip()
    ):
        return None
    return agent_id, space_id


def _typed_selection(selection: Any) -> bool:
    """Validate canonical CLI MailboxSelection, including every authority axis.

    Mirrors nmem-wire MailboxScope/AgentAddress; this is input validation,
    never a live-custody proof or a substitute for owner revalidation.
    """
    if not isinstance(selection, dict) or set(selection) != {"scope", "address"}:
        return False
    scope, address = selection["scope"], selection["address"]
    if (not _typed_scope(scope)
            or not isinstance(address, dict) or set(address) != {"agent_id", "identity_birth", "custodian_id", "attachment_id", "attachment_generation"}):
        return False
    generation = address["attachment_generation"]
    return (
        _canonical_agent_key(address["agent_id"])
        and all(_wire_identifier(address[key]) for key in ("identity_birth", "custodian_id", "attachment_id"))
        and type(generation) is int and 1 <= generation <= (1 << 53) - 1
    )


def _canonical_agent_key(value: Any) -> bool:
    """Storage key already canonical; display labels use a different field."""
    return isinstance(value, str) and re.fullmatch(r"[a-z0-9][a-z0-9_.:-]{0,119}", value) is not None


def _wire_identifier(value: Any) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", value) is not None


def _typed_scope(scope: Any) -> bool:
    return (isinstance(scope, dict)
            and set(scope) == {"store_id", "store_incarnation", "workspace_id", "space_id"}
            and _wire_identifier(scope["store_id"]) and _wire_identifier(scope["store_incarnation"])
            and (scope["workspace_id"] is None or _wire_identifier(scope["workspace_id"]))
            and _is_exact_space_id(scope["space_id"]))


def _string_list(value: Any) -> list[str] | None:
    if not isinstance(value, list) or len(value) > MAX_LIST_ITEMS:
        return None
    result: list[str] = []
    for item in value:
        text = _bounded_text(item, MAX_LIST_ITEM_BYTES, allow_empty=False)
        if text is None:
            return None
        result.append(text)
    return result


def _profile_projection(payload: dict[str, Any], expected_agent: str) -> dict[str, Any] | None:
    allowed = {
        "version",
        "agent_id",
        "revision",
        "description",
        "responsibilities",
        "skills",
    }
    if set(payload) != allowed:
        return None
    version = payload.get("version")
    if not isinstance(version, int) or isinstance(version, bool) or version != MAINTENANCE_VERSION:
        return None
    if payload.get("agent_id") != expected_agent:
        return None
    revision = payload.get("revision")
    if not isinstance(revision, str) or REVISION_RE.fullmatch(revision) is None:
        return None
    description = _bounded_text(payload.get("description"), MAX_DESCRIPTION_BYTES)
    responsibilities = _string_list(payload.get("responsibilities"))
    skills_value = payload.get("skills")
    if description is None or responsibilities is None or not isinstance(skills_value, list):
        return None
    if len(skills_value) > MAX_LIST_ITEMS:
        return None
    skills: list[dict[str, str]] = []
    for skill in skills_value:
        if not isinstance(skill, dict) or set(skill) != {"id", "name"}:
            return None
        skill_id = _bounded_text(skill.get("id"), MAX_SKILL_FIELD_BYTES, allow_empty=False)
        name = _bounded_text(skill.get("name"), MAX_SKILL_FIELD_BYTES, allow_empty=False)
        if skill_id is None or name is None:
            return None
        skills.append({"id": skill_id, "name": name})
    return {
        "version": MAINTENANCE_VERSION,
        "agent_id": expected_agent,
        "revision": revision,
        "description": description,
        "responsibilities": responsibilities,
        "skills": skills,
    }


def _operation_id(
    event: dict[str, Any],
    context: str,
    profile: dict[str, Any],
) -> str:
    basis = {
        "version": MAINTENANCE_VERSION,
        "turn_id": event["turn_id"],
        "agent_context": context,
        "agent_id": profile["agent_id"],
        "revision": profile["revision"],
    }
    encoded = json.dumps(basis, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "codex-stop-v2:" + hashlib.sha256(encoded).hexdigest()


def build_stop_response(event: dict[str, Any]) -> dict[str, Any]:
    """Retain local pending work and let the normal host turn finish."""
    try:
        from nmem_pending import retain_stop
        retain_stop(event)
    except Exception:
        pass
    return NORMAL_STOP_RESPONSE.copy()
