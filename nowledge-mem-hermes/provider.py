"""Nowledge Mem memory provider for Hermes Agent.

Implements the MemoryProvider ABC to give Hermes native access to the
user's cross-tool knowledge graph. Replaces the generic MCP connection
with lifecycle hooks: automatic Context Bundle / Working Memory injection, per-turn
recall, user-profile mirroring, and native tool names.

Transport: ``nmem`` CLI for memory operations, plus direct Mem API calls for
large transcript payloads. The shared ``nmem`` client config still owns server
URL, API key, and remote access.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from agent.memory_provider import MemoryProvider

try:
    from tools.registry import tool_error as _registry_tool_error
except ImportError:
    _registry_tool_error = None

try:
    from tools.registry import tool_result as _registry_tool_result
except ImportError:
    _registry_tool_result = None

from .client import NowledgeMemClient

logger = logging.getLogger(__name__)

GUIDANCE = """\
# Nowledge Mem
Cross-tool personal knowledge graph. Knowledge saved here persists across \
all tools and sessions.

**Nowledge Mem vs Hermes memory:** Hermes memory stores Hermes-specific \
facts (env details, tool quirks). Nowledge Mem stores cross-tool knowledge: \
decisions, procedures, and learnings. Ask yourself: "Would this matter in a \
Claude Code, Cursor, or Codex session?" If yes, save to Nowledge Mem.

Save proactively when the conversation produces a decision, procedure, \
learning, or important context. One strong memory is better than three \
weak ones.

**Upsert by ID:** pass a stable id to nmem_save to create-or-update in one \
call. If a memory with that ID already exists it is updated; otherwise a new \
one is created. Use this when you have a natural key (for example a topic or \
decision name) instead of the search-then-update dance.

Without an id, search first (nmem_search); if existing knowledge covers the \
topic, use nmem_update rather than create a duplicate."""

_SEARCH = {
    "name": "nmem_search",
    "description": "Search stored memories. Supports label filtering, minimum-importance filtering, and deep search mode.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query."},
            "limit": {"type": "integer", "description": "Max results, 1-20 (default 10)."},
            "filter_labels": {
                "type": "string",
                "description": "Comma-separated labels to filter by.",
            },
            "mode": {
                "type": "string",
                "description": "'normal' (fast, default) or 'deep' (graph-enhanced).",
            },
            "min_importance": {
                "type": "number",
                "description": "Minimum importance threshold, 0.0-1.0. Filters out lower-priority memories.",
            },
        },
        "required": ["query"],
    },
}

_SAVE = {
    "name": "nmem_save",
    "description": (
        "Save a decision, insight, procedure, or learning. Pass id to upsert: "
        "update if that ID exists, create if not. Without id, search first to avoid duplicates."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "Memory content."},
            "id": {
                "type": "string",
                "description": "Stable ID for upsert. Omit to auto-generate.",
            },
            "title": {"type": "string", "description": "Descriptive title."},
            "importance": {
                "type": "number",
                "description": "0.0-1.0. 0.8+ major, 0.5-0.7 useful, 0.3-0.4 minor.",
            },
            "labels": {
                "type": "string",
                "description": "Comma-separated labels.",
            },
            "unit_type": {
                "type": "string",
                "description": "fact, preference, decision, plan, procedure, learning, context, or event.",
            },
            "event_date": {
                "type": "string",
                "description": "When it happened (YYYY, YYYY-MM, or YYYY-MM-DD).",
            },
        },
        "required": ["content"],
    },
}

_UPDATE = {
    "name": "nmem_update",
    "description": "Refine an existing memory. Search first to find the memory_id.",
    "parameters": {
        "type": "object",
        "properties": {
            "memory_id": {"type": "string", "description": "Memory ID from search results."},
            "content": {"type": "string", "description": "Updated content (omit to keep current)."},
            "title": {"type": "string", "description": "Updated title (omit to keep current)."},
            "importance": {"type": "number", "description": "Updated importance (omit to keep current)."},
        },
        "required": ["memory_id"],
    },
}

_DELETE = {
    "name": "nmem_delete",
    "description": "Delete one or more memories. Also removes associated relationships and entity links.",
    "parameters": {
        "type": "object",
        "properties": {
            "memory_id": {"type": "string", "description": "Single memory ID to delete."},
            "memory_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Multiple memory IDs for bulk delete.",
            },
        },
        "required": [],
    },
}

_THREAD_SEARCH = {
    "name": "nmem_thread_search",
    "description": "Search past conversations. Returns threads with matched message snippets.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query."},
            "limit": {"type": "integer", "description": "Max threads, 1-50 (default 10)."},
            "source": {
                "type": "string",
                "description": "Filter by source (for example 'claude-code' or 'hermes').",
            },
        },
        "required": ["query"],
    },
}

_THREAD_MESSAGES = {
    "name": "nmem_thread_messages",
    "description": "Fetch messages from a thread. Use after nmem_thread_search.",
    "parameters": {
        "type": "object",
        "properties": {
            "thread_id": {"type": "string", "description": "Thread ID."},
            "offset": {"type": "integer", "description": "Messages to skip (default 0)."},
            "limit": {"type": "integer", "description": "Max messages, 1-100 (default 50)."},
        },
        "required": ["thread_id"],
    },
}

ALL_TOOL_SCHEMAS = [
    _SEARCH,
    _SAVE,
    _UPDATE,
    _DELETE,
    _THREAD_SEARCH,
    _THREAD_MESSAGES,
]

_MESSAGE_TIMESTAMP_KEYS = (
    "timestamp",
    "created_at",
    "createdAt",
    "time",
    "started_at",
    "startedAt",
)

# Ordered by preference (universal across bare metal, VMs, Docker, LPK):
#   1) /etc/machine-id    — systemd hosts (gold standard, unique per machine)
#   2) __mac__            — primary non-loopback MAC address (universal on Linux;
#                           Docker assigns per-host IP to MAC, unique in practice)
#   3) /proc/1/mountinfo  — overlay upperdir layer hash (last resort for
#                           containers; content-addressed, NOT machine-unique)
_FINGERPRINT_SOURCES = (
    "/etc/machine-id",
    "__mac__",
    "/proc/1/mountinfo",
)


def tool_error(message: Any, **extra: Any) -> str:
    """Return Hermes-style JSON error payloads across old and new releases."""
    if _registry_tool_error is not None:
        return _registry_tool_error(message, **extra)

    payload = {"error": str(message)}
    if extra:
        payload.update(extra)
    return json.dumps(payload, ensure_ascii=False)


def tool_result(data: Any = None, **kwargs: Any) -> str:
    """Return Hermes-style JSON result payloads across old and new releases."""
    if _registry_tool_result is not None:
        return _registry_tool_result(data, **kwargs)

    if data is not None:
        if kwargs:
            raise ValueError("tool_result accepts either data or kwargs, not both")
        return json.dumps(data, ensure_ascii=False)
    return json.dumps(kwargs, ensure_ascii=False)


class NowledgeMemProvider(MemoryProvider):
    """Nowledge Mem as a native Hermes memory provider."""

    def __init__(self) -> None:
        self._client: Optional[NowledgeMemClient] = None
        self._context_bundle = ""
        self._working_memory = ""
        self._cron_skipped = False
        self._bg_threads: List[threading.Thread] = []
        self._resolved_space: str | None = None
        self._session_id = ""
        self._saved_message_count = 0
        self._saved_message_counts: Dict[str, int] = {}
        self._agent_identity = ""
        self._delta_only_sessions: Set[str] = set()
        self._written_message_signatures: Dict[str, List[str]] = {}

    @property
    def name(self) -> str:
        return "nowledge-mem"

    def is_available(self) -> bool:
        """Check if nmem CLI is installed. No network calls."""
        return NowledgeMemClient.is_available()

    def initialize(self, session_id: str, **kwargs: Any) -> None:
        agent_context = kwargs.get("agent_context", "")
        platform = kwargs.get("platform", "cli")

        if agent_context in ("cron", "flush") or platform == "cron":
            logger.debug(
                "Nowledge Mem skipped: cron/flush context (agent_context=%s, platform=%s)",
                agent_context,
                platform,
            )
            self._cron_skipped = True
            return

        hermes_home = kwargs.get("hermes_home", "")
        config = self._load_config(hermes_home)
        raw_timeout = config.get("timeout", 30)
        try:
            timeout = int(raw_timeout or 30)
        except (TypeError, ValueError):
            logger.warning(
                "Invalid timeout in nowledge-mem.json: %r; falling back to 30s",
                raw_timeout,
            )
            timeout = 30
        if timeout <= 0:
            timeout = 30

        # Resolve agent identity once, auto-generating a fingerprint if needed.
        self._agent_identity = self._resolve_agent_identity(config, kwargs)
        if self._agent_identity and not config.get("agent_identity"):
            self._save_agent_identity(hermes_home, self._agent_identity)

        self._resolved_space = self._resolve_space(config, self._agent_identity)
        self._client = NowledgeMemClient(timeout=timeout, space=self._resolved_space)
        self._activate_session(session_id or "", reset=True)

        if not self._client.health():
            logger.warning("Nowledge Mem not reachable via nmem CLI")
            self._client = None
            return

        host_agent_id = self._agent_identity or None
        try:
            context_bundle = getattr(self._client, "context_bundle")(
                source_app="hermes",
                host_agent_id=host_agent_id,
            )
            self._context_bundle = self._format_context_bundle(context_bundle)
        except Exception as error:
            logger.debug("Context bundle fetch failed: %s", error)
            self._context_bundle = ""

        if not self._context_bundle:
            try:
                wm = self._client.working_memory()
                self._working_memory = self._format_working_memory(wm)
            except Exception as error:
                logger.debug("Working memory fetch failed: %s", error)
                self._working_memory = ""

        logger.info(
            "Nowledge Mem provider initialized (CLI transport)",
            extra={
                "space": self._resolved_space or "default",
                "agent_identity": self._agent_identity or "default",
            },
        )

    def system_prompt_block(self) -> str:
        if self._cron_skipped:
            return ""

        parts = [GUIDANCE]
        if self._resolved_space:
            parts.append(f"## Active Space\n\n{self._resolved_space}")
        if self._context_bundle:
            parts.append(self._context_bundle)
        elif self._working_memory:
            parts.append(f"## Working Memory\n\n{self._working_memory}")
        elif self._client:
            parts.append("## Working Memory\n\nNo briefing available yet. The knowledge graph is connected.")
        else:
            parts.append(
                "## Working Memory\n\nNowledge Mem server is not reachable. Tools are unavailable until the server is running."
            )
        return "\n\n".join(parts)

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        if self._cron_skipped or not self._client:
            return ""
        if not query or len(query.strip()) < 10:
            return ""

        try:
            result = self._client.search(query.strip()[:200], limit=5)
            return self._format_prefetch(result)
        except Exception as error:
            logger.debug("Nowledge Mem prefetch failed: %s", error)
            return ""

    def on_memory_write(self, action: str, target: str, content: str) -> None:
        if self._cron_skipped or not self._client:
            return
        if action != "add" or target != "user" or not content:
            return

        client = self._client

        def _mirror() -> None:
            try:
                client.save(
                    content,
                    title="User profile (synced from Hermes)",
                    labels=["hermes-profile"],
                    importance=0.5,
                )
                logger.debug("Mirrored user-profile write to Nowledge Mem")
            except Exception as error:
                logger.debug("Mirror write failed (non-fatal): %s", error)

        thread = threading.Thread(target=_mirror, daemon=True, name="nmem-mirror")
        thread.start()
        self._bg_threads.append(thread)

    def sync_turn(
        self,
        user_content: str,
        assistant_content: str,
        *,
        session_id: str = "",
        messages: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        if self._cron_skipped or not self._client:
            return

        active_session_id = (session_id or self._session_id or "").strip()
        if not active_session_id:
            return
        if not user_content and not assistant_content and not messages:
            return

        self._activate_session(active_session_id)
        if messages and active_session_id not in self._delta_only_sessions:
            cleaned_messages = self._clean_session_messages(messages)
            if cleaned_messages:
                self._sync_cleaned_messages(cleaned_messages, title_messages=cleaned_messages)
                return

        cleaned_messages = self._clean_session_messages(
            [
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": assistant_content},
            ]
        )
        self._write_thread_messages(cleaned_messages, title_messages=cleaned_messages)

    def on_session_switch(
        self,
        new_session_id: str,
        *,
        parent_session_id: str = "",
        reset: bool = False,
        **kwargs: Any,
    ) -> None:
        if self._cron_skipped:
            return
        self._activate_session(new_session_id, reset=reset)

    def _activate_session(self, session_id: str, *, reset: bool = False) -> None:
        session_id = (session_id or "").strip()
        if not session_id:
            return
        previous_session_id = self._session_id
        if reset:
            count = 0
            self._delta_only_sessions.discard(session_id)
            self._written_message_signatures.pop(session_id, None)
        elif session_id in self._saved_message_counts:
            count = self._get_saved_message_count(session_id)
        elif session_id == previous_session_id:
            count = int(self._saved_message_count or 0)
        else:
            count = 0
            self._delta_only_sessions.add(session_id)
        self._saved_message_counts[session_id] = count
        self._session_id = session_id
        self._saved_message_count = count

    def _get_saved_message_count(self, session_id: str) -> int:
        if session_id in self._saved_message_counts:
            return int(self._saved_message_counts.get(session_id) or 0)
        if session_id == self._session_id:
            return int(self._saved_message_count or 0)
        return 0

    def _set_saved_message_count(self, session_id: str, count: int) -> None:
        count = max(0, int(count or 0))
        self._saved_message_counts[session_id] = count
        if session_id == self._session_id:
            self._saved_message_count = count

    def on_pre_compress(self, messages: List[Dict[str, Any]]) -> str:
        if self._cron_skipped or not self._client:
            return ""
        return (
            "Cross-session knowledge is stored in Nowledge Mem. Decisions and insights "
            "from compressed messages can be recovered via nmem_search. Preserve references "
            "to memory IDs if any were mentioned."
        )

    def on_session_end(self, messages: List[Dict[str, Any]]) -> None:
        if self._cron_skipped or not self._client:
            return
        session_id = (self._session_id or "").strip()
        if not session_id:
            return

        cleaned_messages = self._clean_session_messages(messages)
        if not cleaned_messages:
            return

        self._sync_cleaned_messages(cleaned_messages, title_messages=cleaned_messages)

    def _sync_cleaned_messages(
        self,
        cleaned_messages: List[Dict[str, Any]],
        *,
        title_messages: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        session_id = (self._session_id or "").strip()
        if not session_id or not cleaned_messages:
            return

        if session_id in self._delta_only_sessions:
            delta = self._unsynced_messages(session_id, cleaned_messages)
            if not delta:
                return
            self._write_thread_messages(delta, title_messages=title_messages or cleaned_messages)
            return

        saved_count = self._get_saved_message_count(session_id)
        if saved_count > len(cleaned_messages):
            saved_count = 0
            self._set_saved_message_count(session_id, 0)

        if saved_count <= 0:
            self._write_thread_messages(cleaned_messages, title_messages=cleaned_messages)
            return

        delta = cleaned_messages[saved_count:]
        if not delta:
            return
        self._write_thread_messages(delta, title_messages=cleaned_messages)

    def _unsynced_messages(
        self,
        session_id: str,
        messages: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        written = list(self._written_message_signatures.get(session_id) or [])
        if not written:
            return []

        signatures = [self._message_signature(message) for message in messages]
        search_from = 0
        last_match = -1
        for expected in written:
            try:
                match_at = signatures.index(expected, search_from)
            except ValueError:
                return []
            last_match = match_at
            search_from = match_at + 1
        return messages[last_match + 1 :]

    def _remember_written_messages(
        self,
        session_id: str,
        messages: List[Dict[str, Any]],
    ) -> None:
        if not session_id or not messages:
            return
        bucket = self._written_message_signatures.setdefault(session_id, [])
        for message in messages:
            bucket.append(self._message_signature(message))

    @staticmethod
    def _message_signature(message: Dict[str, Any]) -> str:
        role = str(message.get("role") or "")
        content = str(message.get("content") or "")
        return f"{role}\0{content}"

    def _write_thread_messages(
        self,
        messages: List[Dict[str, Any]],
        *,
        title_messages: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        if not self._client or not messages:
            return
        session_id = (self._session_id or "").strip()
        if not session_id:
            return

        saved_count = self._get_saved_message_count(session_id)
        if saved_count <= 0:
            title = self._build_thread_title(title_messages or messages)
            try:
                result = self._client.import_thread(
                    session_id,
                    messages,
                    title=title or None,
                    source="hermes",
                )
                if not self._response_succeeded(result):
                    if self._thread_already_exists(result):
                        self._delta_only_sessions.add(session_id)
                        self._append_existing_thread(session_id, messages)
                        self._remember_written_messages(session_id, messages)
                        self._set_saved_message_count(session_id, saved_count + len(messages))
                        return
                    logger.warning(
                        "Nowledge Mem session import did not succeed for %s: %s",
                        session_id,
                        self._response_error(result),
                    )
                    return
            except Exception as error:
                logger.warning(
                    "Nowledge Mem session import failed for %s: %s",
                    session_id,
                    error,
                )
                return
            self._remember_written_messages(session_id, messages)
            self._set_saved_message_count(session_id, saved_count + len(messages))
            return

        try:
            self._append_existing_thread(session_id, messages)
        except Exception as error:
            logger.warning(
                "Nowledge Mem session append failed for %s: %s",
                session_id,
                error,
            )
            return
        self._remember_written_messages(session_id, messages)
        self._set_saved_message_count(session_id, saved_count + len(messages))

    def _append_existing_thread(self, session_id: str, messages: List[Dict[str, Any]]) -> None:
        assert self._client is not None
        result = self._client.append_thread(session_id, messages)
        if not self._response_succeeded(result):
            raise RuntimeError(self._response_error(result))

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        if self._cron_skipped:
            return []
        return list(ALL_TOOL_SCHEMAS)

    def handle_tool_call(self, tool_name: str, args: Dict[str, Any], **kwargs: Any) -> str:
        if not self._client:
            return tool_error("Nowledge Mem is not connected.", success=False)

        try:
            result = self._dispatch(tool_name, args)
            return tool_result(self._normalize_tool_result(result))
        except Exception as error:
            logger.error("Tool %s failed: %s", tool_name, error)
            return tool_error(f"{tool_name} failed: {error}", success=False, tool=tool_name)

    def _dispatch(self, tool_name: str, args: Dict[str, Any]) -> Any:
        assert self._client is not None
        client = self._client

        if tool_name == "nmem_search":
            return client.search(
                args.get("query", ""),
                limit=args.get("limit", 10),
                filter_labels=self._parse_csv(args.get("filter_labels")),
                mode=args.get("mode"),
                min_importance=args.get("min_importance"),
            )
        if tool_name == "nmem_save":
            return client.save(
                args["content"],
                memory_id=args.get("id"),
                title=args.get("title"),
                importance=args.get("importance"),
                labels=self._parse_csv(args.get("labels")),
                unit_type=args.get("unit_type"),
                event_date=args.get("event_date"),
            )
        if tool_name == "nmem_update":
            return client.update(
                args["memory_id"],
                content=args.get("content"),
                title=args.get("title"),
                importance=args.get("importance"),
            )
        if tool_name == "nmem_delete":
            memory_ids = self._normalize_id_list(args.get("memory_ids"))
            if memory_ids:
                return client.delete_many(memory_ids)
            if args.get("memory_id"):
                return client.delete(args["memory_id"])
            raise ValueError("nmem_delete requires memory_id or memory_ids")
        if tool_name == "nmem_thread_search":
            return client.thread_search(
                args.get("query", ""),
                limit=args.get("limit", 10),
                source=args.get("source"),
            )
        if tool_name == "nmem_thread_messages":
            return client.thread_messages(
                args["thread_id"],
                limit=args.get("limit", 50),
                offset=args.get("offset", 0),
            )
        raise ValueError(f"Unknown tool: {tool_name}")

    def get_config_schema(self) -> List[Dict[str, Any]]:
        return [
            {
                "key": "timeout",
                "description": "Request timeout in seconds",
                "default": "30",
            },
            {
                "key": "space",
                "description": "Optional default space name for this Hermes provider",
                "default": "",
            },
            {
                "key": "space_by_identity",
                "description": 'Optional JSON object mapping Hermes identities to space names, for example {"research":"Research Agent"}',
                "default": "",
            },
            {
                "key": "space_template",
                "description": "Optional template like research-{identity}; used when space is empty",
                "default": "",
            },
        ]

    def save_config(self, values: Dict[str, Any], hermes_home: str) -> None:
        config_path = Path(hermes_home) / "nowledge-mem.json"
        existing: dict = {}
        if config_path.exists():
            try:
                existing = json.loads(config_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as err:
                logger.error(
                    "Cannot read Nowledge Mem config %s; refusing to overwrite it: %s",
                    config_path,
                    err,
                )
                raise RuntimeError(
                    f"Cannot read existing Nowledge Mem config at {config_path}; "
                    "fix or remove the file before saving settings."
                ) from err
        existing.update(values)
        config_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")
        logger.info("Nowledge Mem config saved to %s", config_path)

    def shutdown(self) -> None:
        for thread in self._bg_threads:
            if thread.is_alive():
                thread.join(timeout=3.0)
        self._bg_threads.clear()
        self._resolved_space = None
        self._session_id = ""
        self._saved_message_count = 0
        self._saved_message_counts.clear()
        self._delta_only_sessions.clear()
        self._written_message_signatures.clear()

    @staticmethod
    def _parse_csv(value: Any) -> Optional[List[str]]:
        return NowledgeMemProvider._to_str_list(value)

    @staticmethod
    def _normalize_id_list(value: Any) -> Optional[List[str]]:
        return NowledgeMemProvider._to_str_list(value)

    @staticmethod
    def _to_str_list(value: Any) -> Optional[List[str]]:
        if value is None:
            return None
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, (list, tuple, set)):
            parsed = [str(item).strip() for item in value if str(item).strip()]
            return parsed or None

        text = str(value).strip()
        return [text] if text else None

    @staticmethod
    def _normalize_tool_result(result: Any) -> Any:
        if isinstance(result, dict):
            if "success" not in result and "error" not in result:
                return {"success": True, **result}
            return result
        return {"success": True, "result": result}

    @staticmethod
    def _response_succeeded(result: Any) -> bool:
        if not isinstance(result, dict):
            return True
        success = result.get("success")
        if success is False:
            return False
        results = result.get("results")
        if isinstance(results, list) and results:
            return all(
                not isinstance(item, dict) or item.get("success") is not False
                for item in results
            )
        return True

    @staticmethod
    def _thread_already_exists(result: Any) -> bool:
        return "already exists" in NowledgeMemProvider._response_error(result).lower()

    @staticmethod
    def _response_error(result: Any) -> str:
        if not isinstance(result, dict):
            return str(result)
        errors: List[str] = []
        if result.get("error"):
            errors.append(str(result.get("error")))
        for item in result.get("results") or []:
            if isinstance(item, dict) and item.get("error"):
                errors.append(str(item.get("error")))
        return "; ".join(errors) or json.dumps(result, ensure_ascii=False)[:300]

    # ── agent identity resolution ────────────────────────────────────

    @staticmethod
    def _resolve_agent_identity(
        config: Dict[str, Any],
        kwargs: Dict[str, Any],
    ) -> str:
        """Resolve the agent identity for this client.

        1. Hermes gives a named profile identity (not "default") → use it.
        2. ``nowledge-mem.json`` has an explicit ``agent_identity`` → use it.
        3. Otherwise → generate a stable fingerprint from system sources.
        """
        raw_identity = kwargs.get("agent_identity")
        identity = str(raw_identity).strip() if raw_identity else ""
        if identity and identity != "default":
            return identity
        config_identity = config.get("agent_identity")
        if isinstance(config_identity, str) and config_identity.strip():
            return config_identity.strip()
        fingerprint = NowledgeMemProvider._generate_fingerprint()
        if fingerprint:
            logger.info(
                "Auto-generated agent identity fingerprint: %s", fingerprint
            )
            return fingerprint
        return identity

    @staticmethod
    def _generate_fingerprint() -> str:
        """Derive a stable agent-identity fingerprint from system sources.

        Tries each source in ``_FINGERPRINT_SOURCES`` in order:

        * ``/etc/machine-id`` — standard on systemd hosts.
        * ``__mac__`` — first non-loopback MAC address (universal on Linux).
        * ``/proc/1/mountinfo`` — overlay upperdir layer hash (last resort).

        Prefix by source: ``hermes-`` for machine-id/MAC, ``overlay-`` for mountinfo.
        """
        for source in _FINGERPRINT_SOURCES:
            try:
                if source == "/proc/1/mountinfo":
                    raw = Path(source).read_text(encoding="utf-8").strip()
                    if not raw:
                        continue
                    raw = NowledgeMemProvider._extract_overlay_id(raw)
                    if not raw:
                        continue
                    prefix = "overlay"
                elif source == "__mac__":
                    raw = NowledgeMemProvider._read_primary_mac()
                    if not raw:
                        continue
                    prefix = "hermes"
                else:
                    raw = Path(source).read_text(encoding="utf-8").strip()
                    if not raw:
                        continue
                    prefix = "hermes"
            except (OSError, UnicodeDecodeError):
                continue

            suffix = hashlib.sha256(raw.encode()).hexdigest()[:8]
            return f"{prefix}-{suffix}"

        return ""

    @staticmethod
    def _read_primary_mac() -> str:
        """Return the MAC address of the first non-loopback interface.

        Scans ``/sys/class/net/*/address``, skips loopback
        (``00:00:00:00:00:00``), and returns the first valid MAC found.
        Returns an empty string if none is available.
        """
        import glob as _glob
        for addr_path in sorted(_glob.glob("/sys/class/net/*/address")):
            try:
                addr = Path(addr_path).read_text(encoding="utf-8").strip()
            except (OSError, UnicodeDecodeError):
                continue
            if addr and addr != "00:00:00:00:00:00":
                return addr
        return ""

    @staticmethod
    def _extract_overlay_id(mountinfo: str) -> str:
        """Extract the overlay upperdir layer ID from /proc/1/mountinfo.

        Docker's overlay2 driver stores container-specific layers in
        ``upperdir``.  The directory name is a SHA256 hash unique to
        the container and stable across restarts.
        """
        import re as _re
        for line in mountinfo.splitlines():
            if " / " not in line or "overlay" not in line:
                continue
            m = _re.search(r"upperdir=([^,]+)", line)
            if not m:
                continue
            parts = m.group(1).rstrip("/").split("/")
            for part in reversed(parts):
                if len(part) >= 32 and all(c in "0123456789abcdef" for c in part):
                    return part
        return ""

    @staticmethod
    def _save_agent_identity(hermes_home: str, agent_identity: str) -> None:
        """Persist the resolved agent identity into ``nowledge-mem.json``
        so the fingerprint survives restarts and is not regenerated."""
        if not hermes_home or not agent_identity:
            return
        config_path = Path(hermes_home) / "nowledge-mem.json"
        try:
            if config_path.exists():
                try:
                    cfg = json.loads(config_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    cfg = {}
            else:
                cfg = {}
            if not isinstance(cfg, dict):
                cfg = {}
            if cfg.get("agent_identity") == agent_identity:
                return
            cfg["agent_identity"] = agent_identity
            config_path.parent.mkdir(parents=True, exist_ok=True)
            config_path.write_text(
                json.dumps(cfg, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            logger.info(
                "Persisted agent_identity=%s to %s", agent_identity, config_path
            )
        except OSError as exc:
            logger.debug(
                "Could not save agent_identity to %s: %s", config_path, exc
            )

    # ── config loading / space resolution ────────────────────────────

    @staticmethod
    def _load_config(hermes_home: str) -> Dict[str, Any]:
        if hermes_home:
            config_path = Path(hermes_home) / "nowledge-mem.json"
            if config_path.exists():
                try:
                    cfg = json.loads(config_path.read_text(encoding="utf-8"))
                    if isinstance(cfg, dict):
                        return cfg
                except Exception as err:
                    logger.debug(
                        "Failed to parse nowledge-mem config %s under hermes_home=%s: %s",
                        config_path,
                        hermes_home,
                        err,
                    )
        return {}

    @staticmethod
    def _resolve_space(config: Dict[str, Any], identity: str) -> str | None:
        if "space" in config:
            raw_space = config.get("space")
            if isinstance(raw_space, str):
                return raw_space.strip()

        identity = (identity or "").strip()
        identity_map = config.get("space_by_identity")
        if isinstance(identity_map, str):
            try:
                identity_map = json.loads(identity_map)
            except Exception:
                identity_map = None
        if identity and isinstance(identity_map, dict):
            mapped = identity_map.get(identity)
            if isinstance(mapped, str) and mapped.strip():
                return mapped.strip()

        template = str(config.get("space_template") or "").strip()
        if identity and template:
            resolved = template.replace("{identity}", identity)
            resolved = " ".join(resolved.split()).strip()
            if resolved:
                return resolved

        env_space = (os.environ.get("NMEM_SPACE") or "").strip()
        if env_space:
            return env_space

        legacy_env_space = (os.environ.get("NMEM_SPACE_ID") or "").strip()
        if legacy_env_space:
            return legacy_env_space

        return None

    @staticmethod
    def _format_context_bundle(bundle: Any) -> str:
        if not isinstance(bundle, dict):
            return ""
        content = bundle.get("rendered_markdown") or bundle.get("content") or ""
        return str(content).strip()

    @staticmethod
    def _format_working_memory(wm: Any) -> str:
        if not wm:
            return ""
        if isinstance(wm, dict):
            content = wm.get("content", "") or wm.get("briefing", "")
            if isinstance(content, str) and content.strip():
                return content.strip()
            return json.dumps(wm, indent=2, ensure_ascii=False)
        if isinstance(wm, str):
            return wm.strip()
        return str(wm)

    @staticmethod
    def _format_prefetch(result: Any) -> str:
        if not result or not isinstance(result, dict):
            return ""
        memories = result.get("memories", result.get("results", []))
        if not memories:
            return ""

        lines: List[str] = []
        for memory in memories[:5]:
            score = memory.get("score", memory.get("relevance_score", 0))
            if score < 0.3:
                continue
            title = memory.get("title", "Untitled")
            content = (memory.get("content", "") or "")[:300]
            labels = memory.get("labels", [])
            label_str = f" [{', '.join(labels)}]" if labels else ""
            lines.append(f"- **{title}**{label_str}: {content}")

        if not lines:
            return ""
        return "## Recalled from Nowledge Mem\n" + "\n".join(lines)

    @staticmethod
    def _clean_session_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        cleaned: List[Dict[str, Any]] = []
        for message in messages or []:
            if not isinstance(message, dict):
                continue
            role = str(message.get("role") or "").strip()
            if role not in {"user", "assistant"}:
                continue
            content = NowledgeMemProvider._extract_message_text(message.get("content"))
            if not content:
                continue
            cleaned_message: Dict[str, Any] = {"role": role, "content": content}
            timestamp = NowledgeMemProvider._extract_message_timestamp(message)
            if timestamp:
                cleaned_message["timestamp"] = timestamp
            cleaned.append(cleaned_message)
        return cleaned

    @staticmethod
    def _extract_message_timestamp(message: Dict[str, Any]) -> str:
        for key in _MESSAGE_TIMESTAMP_KEYS:
            if key not in message:
                continue
            normalized = NowledgeMemProvider._normalize_message_timestamp(
                message.get(key)
            )
            if normalized:
                return normalized
        return ""

    @staticmethod
    def _normalize_message_timestamp(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, (int, float)):
            return NowledgeMemProvider._format_unix_timestamp(float(value))
        if not isinstance(value, str):
            return ""

        text = value.strip()
        if not text:
            return ""
        try:
            return NowledgeMemProvider._format_unix_timestamp(float(text))
        except ValueError:
            pass

        normalized = text
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        elif normalized.endswith(" UTC"):
            normalized = f"{normalized[:-4]}+00:00"
        try:
            dt = datetime.fromisoformat(normalized)
        except ValueError:
            return ""
        if dt.tzinfo is None:
            return dt.isoformat(timespec="seconds")
        return dt.astimezone().isoformat(timespec="seconds")

    @staticmethod
    def _format_unix_timestamp(value: float) -> str:
        magnitude = abs(value)
        if magnitude > 100_000_000_000_000:
            value = value / 1_000_000
        elif magnitude > 10_000_000_000:
            value = value / 1_000
        try:
            dt = datetime.fromtimestamp(value, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return ""
        return dt.astimezone().isoformat(timespec="seconds")

    @staticmethod
    def _extract_message_text(content: Any) -> str:
        if content is None:
            return ""
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = [NowledgeMemProvider._extract_message_text(item) for item in content]
            return "\n".join(part for part in parts if part).strip()
        if isinstance(content, dict):
            if "text" in content:
                return NowledgeMemProvider._extract_message_text(content.get("text"))
            if "content" in content:
                return NowledgeMemProvider._extract_message_text(content.get("content"))
            return ""
        return str(content).strip()

    @staticmethod
    def _build_thread_title(messages: List[Dict[str, Any]]) -> str:
        for message in messages:
            if message.get("role") != "user":
                continue
            first_line = next(
                (line.strip() for line in message.get("content", "").splitlines() if line.strip()),
                "",
            )
            if first_line:
                return first_line[:80]
        return "Hermes session"
